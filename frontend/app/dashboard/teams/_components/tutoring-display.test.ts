import { describe, expect, it } from "vitest";
import type { TutorReportWeekRow } from "@/lib/types/tutor-report-log";
import {
  compareSessions, formatTutorMinutes, getSessionDay, normalizeCourses,
  receiptTimingLabel, scholarLabel, scholarStatus, sessionBlockKey,
  sessionDurationMinutes, sessionStartMinutes, tutoringSessionSummary,
  tutoringSessionTimeLabel,
} from "./tutoring-display";

function row(overrides: Partial<TutorReportWeekRow> = {}): TutorReportWeekRow {
  return {
    id: 1, date: "2026-10-14", tutor_name: "Taylor Tutor", scholar_uid: "123456789",
    scholar_name: "Sam Scholar", day_of_week: "Wednesday", start_time: "14:00:00",
    end_time: "15:00:00", courses: ["MATH 140"], created_at: "2026-10-14T19:14:00Z",
    ...overrides,
  };
}

describe("tutoring display", () => {
  it("normalizes and deduplicates display courses without losing suffixes", () => {
    expect(normalizeCourses([" math 140 ", "MATH140", "", "  ", "math140h", "ENGL 101 A"])).toEqual(["MATH140", "MATH140H", "ENGL101A"]);
  });

  it.each([null, "", "  ", "n/a", " N/A ", "111111111"])("recognizes no-scholar UID %s", (scholar_uid) => {
    expect(scholarStatus(row({ scholar_uid }))).toBe("none");
    expect(scholarLabel(row({ scholar_uid }))).toBe("—");
  });

  it("recognizes empty sessions, unmatched IDs, and matched names", () => {
    expect(scholarStatus(row({ scholar_name: " EMPTY SESSION " }))).toBe("none");
    for (const scholar_name of ["", "  ", " 123456789 "]) {
      expect(scholarStatus(row({ scholar_name }))).toBe("unmatched");
      expect(scholarLabel(row({ scholar_name }))).toBe("Unmatched ID");
    }
    expect(scholarStatus(row())).toBe("matched");
    expect(scholarLabel(row({ scholar_name: " Sam Scholar " }))).toBe("Sam Scholar");
  });

  it("uses session dates, then Eastern start timestamps, never receipt dates", () => {
    expect(getSessionDay(row())).toEqual({ key: "2026-10-14", label: "Wed, Oct 14" });
    expect(getSessionDay(row({ date: null, start_time: "2026-10-15T01:00:00Z" })).key).toBe("2026-10-14");
    expect(getSessionDay(row({ date: "2026-02-30" })).label).toBe("Unknown day");
    expect(getSessionDay(row({ date: null })).label).toBe("Unknown day");
  });

  it.each([
    ["14:00:00", "15:00:00", "2:00–3:00 PM"],
    ["2:00 pm", "3:00 PM", "2:00–3:00 PM"],
    ["11:30 AM", "1:00 PM", "11:30 AM–1:00 PM"],
    ["23:30", "00:30", "11:30 PM–12:30 AM"],
    ["2026-10-14T18:00:00Z", "2026-10-14T19:00:00Z", "2:00–3:00 PM"],
  ])("formats %s to %s", (start_time, end_time, expected) => {
    expect(tutoringSessionTimeLabel(row({ start_time, end_time }))).toBe(expected);
  });

  it("formats durations, overnight sessions, and summaries", () => {
    expect(sessionStartMinutes(row())).toBe(840);
    expect(sessionDurationMinutes(row())).toBe(60);
    expect(sessionDurationMinutes(row({ start_time: "23:30", end_time: "01:00" }))).toBe(90);
    expect(sessionDurationMinutes(row({ end_time: "bad" }))).toBeNull();
    expect(sessionStartMinutes(row({ start_time: "24:00" }))).toBeNull();
    expect(tutoringSessionSummary(row())).toBe("Wed, Oct 14 · 2:00–3:00 PM (1 hr)");
    expect([60, 90, 30, 0].map(formatTutorMinutes)).toEqual(["1 hr", "1 hr 30 min", "30 min", "0 min"]);
  });

  it("groups equivalent clocks and tutors but separates days, tutors, and incomplete forms", () => {
    expect(sessionBlockKey(row())).toBe(sessionBlockKey(row({ id: 2, tutor_name: " TAYLOR   TUTOR ", start_time: "2:00 PM", end_time: "3:00 PM" })));
    expect(sessionBlockKey(row())).not.toBe(sessionBlockKey(row({ date: "2026-10-15" })));
    expect(sessionBlockKey(row())).not.toBe(sessionBlockKey(row({ tutor_name: "Another Tutor" })));
    for (const missing of [{ date: null }, { start_time: "" }, { end_time: "n/a" }]) {
      expect(sessionBlockKey(row(missing))).not.toBe(sessionBlockKey(row({ ...missing, id: 2 })));
    }
  });

  it("sorts mixed clock formats chronologically with deterministic ties", () => {
    const sessions = [row({ id: 5, date: null }), row({ id: 4, date: "2026-10-15" }), row({ id: 3, start_time: "3:00 PM" }), row({ id: 2 }), row({ id: 1, start_time: "2026-10-14T13:00:00Z" })];
    expect(sessions.sort(compareSessions).map((session) => session.id)).toEqual([1, 2, 3, 4, 5]);
    expect(compareSessions(row(), row())).toBe(0);
    expect(compareSessions(row({ start_time: "bad" }), row({ start_time: "bad" }))).toBe(0);
  });

  it("labels receipt timing after and before session end without implying submission", () => {
    expect(receiptTimingLabel(row())).toBe("Received 14 min after session ended");
    expect(receiptTimingLabel(row({ created_at: "2026-10-14T18:46:00Z" }))).toBe("Received 14 min before session ended");
    expect(receiptTimingLabel(row({ created_at: "2026-10-14T19:00:00Z" }))).toBe("Received when session ended");
    expect(receiptTimingLabel(row({ start_time: "23:30", end_time: "00:30", created_at: "2026-10-15T04:44:00Z" }))).toBe("Received 14 min after session ended");
  });

  it("resolves Eastern session ends across both DST transitions", () => {
    expect(receiptTimingLabel(row({ date: "2026-03-08", start_time: "01:30", end_time: "03:30", created_at: "2026-03-08T07:44:00Z" }))).toBe("Received 14 min after session ended");
    expect(receiptTimingLabel(row({ date: "2026-10-31", start_time: "23:30", end_time: "02:30", created_at: "2026-11-01T07:44:00Z" }))).toBe("Received 14 min after session ended");
    expect(receiptTimingLabel(row({ date: "2026-03-08", start_time: "01:30", end_time: "02:30", created_at: "2026-03-08T07:44:00Z" }))).toBe("Receipt timing unavailable");
  });

  it.each([{ created_at: null }, { created_at: "invalid" }, { date: null }, { end_time: "invalid" }, { start_time: "" }])("handles unavailable receipt timing %j", (overrides) => {
    expect(receiptTimingLabel(row(overrides))).toBe("Receipt timing unavailable");
  });
});
