import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import {
  attendanceRowsForUids,
  campusWeekStartDate,
  completionPct,
  effectiveMinutes,
  loggedMinutes,
  parseAttendanceKind,
} from "../services/attendance-week.service.js";
import {
  campusWeekToDateRange,
  getEasternDateParts,
} from "../services/time.service.js";
import { EMPTY_WEEKLY_MINUTES } from "../models/weekly-minutes.model.js";

describe("Attendance week helpers", () => {
  it("parseAttendanceKind accepts only FD/SS kinds", () => {
    expect(parseAttendanceKind("front_desk")).toBe("front_desk");
    expect(parseAttendanceKind("study_session")).toBe("study_session");
    expect(parseAttendanceKind("study")).toBeNull();
    expect(parseAttendanceKind(null)).toBeNull();
  });

  it("loggedMinutes sums Mon–Fri", () => {
    expect(loggedMinutes(EMPTY_WEEKLY_MINUTES)).toBe(0);
    expect(
      loggedMinutes({
        mon_min: 30,
        tues_min: 15,
        wed_min: 0,
        thurs_min: 45,
        fri_min: 10,
      })
    ).toBe(100);
  });

  it("effectiveMinutes adds excuse to logged", () => {
    expect(effectiveMinutes(100, 20)).toBe(120);
    expect(effectiveMinutes(0, 60)).toBe(60);
  });

  it("completionPct matches Memo-style rounding and null required", () => {
    expect(completionPct(90, 100)).toBe(90);
    expect(completionPct(0, 60)).toBe(0);
    expect(completionPct(60, null)).toBeNull();
    expect(completionPct(60, 0)).toBeNull();
  });

  it("campusWeekStartDate is the Eastern date of the campus week range start", () => {
    expect(campusWeekStartDate(0)).toBeNull();
    const weekOne = campusWeekToDateRange(1);
    expect(weekOne).not.toBeNull();
    const { year, month, day } = getEasternDateParts(weekOne!.startDate);
    const expected = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    expect(campusWeekStartDate(1)).toBe(expected);
    expect(campusWeekStartDate(2)).not.toBe(campusWeekStartDate(1));
  });

  it("attendanceRowsForUids emits FD then SS rows, including excuse-only and zeros", () => {
    const fdByUid = new Map([
      [
        "s-1",
        {
          minutes: {
            mon_min: 30,
            tues_min: 0,
            wed_min: 0,
            thurs_min: 0,
            fri_min: 0,
          },
          loggedMin: 30,
          excuseMin: 15,
          description: "Doctor",
        },
      ],
    ]);
    const ssByUid = new Map([
      [
        "s-2",
        {
          minutes: EMPTY_WEEKLY_MINUTES,
          loggedMin: 0,
          excuseMin: 60,
          description: "Sick",
        },
      ],
    ]);

    const rows = attendanceRowsForUids(3, ["s-1", "s-2", "s-1", ""], fdByUid, ssByUid);
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => `${r.scholar_uid}:${r.kind}`)).toEqual([
      "s-1:front_desk",
      "s-1:study_session",
      "s-2:front_desk",
      "s-2:study_session",
    ]);
    expect(rows[0]).toMatchObject({
      logged_min: 30,
      excuse_min: 15,
      effective_min: 45,
      description: "Doctor",
      mon_min: 30,
    });
    expect(rows[1]).toMatchObject({
      logged_min: 0,
      excuse_min: 0,
      effective_min: 0,
      description: null,
    });
    expect(rows[2]).toMatchObject({
      logged_min: 0,
      excuse_min: 0,
      effective_min: 0,
    });
    expect(rows[3]).toMatchObject({
      logged_min: 0,
      excuse_min: 60,
      effective_min: 60,
      description: "Sick",
    });
  });
});

describe("Attendance routes — auth gating", () => {
  it("GET /api/attendance/week/:weekNum returns 401 without token", async () => {
    const res = await request(app).get(
      "/api/attendance/week/1?kind=front_desk"
    );
    expect(res.status).toBe(401);
  });

  it("PATCH /api/attendance/excuse returns 401 without token", async () => {
    const res = await request(app)
      .patch("/api/attendance/excuse")
      .send({
        uid: "123",
        weekNum: 1,
        kind: "front_desk",
        excuse_min: 30,
        description: "Sick",
      });
    expect(res.status).toBe(401);
  });

  it("POST /api/attendance/week/:weekNum/by-uids returns 401 without token", async () => {
    const res = await request(app)
      .post("/api/attendance/week/1/by-uids")
      .send({ uids: ["123"] });
    expect(res.status).toBe(401);
  });
});
