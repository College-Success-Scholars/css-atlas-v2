/**
 * @file data.ts
 * @module frontend/lib/server
 *
 * Typed wrapper functions for every backend API endpoint.
 * This is the preferred way for Server Components and pages to fetch domain data.
 * Each function calls backendGet/backendPost/backendPut/backendPatch/backendDelete/backendDownload from api-client.ts
 * and returns a strongly-typed result.
 *
 * ## Responsibilities
 * - Provide a typed function for every backend endpoint consumed by the frontend
 * - Keep endpoint paths and return types co-located
 *
 * ## What belongs here
 * - One function per backend endpoint (or logical operation)
 * - Type annotations for request params and response shapes
 *
 * ## What does NOT belong here
 * - The fetch infrastructure (that's api-client.ts)
 * - Business logic or data transformation
 * - Client-side data fetching (that's lib/client/api-client.ts)
 */
import "server-only";
import { backendGet, backendPost, backendPut, backendPatch, backendDelete, backendDownload, callEndpoint } from "./api-client";
import type { EndpointRequest } from "@css-atlas/shared/contract";
import * as attendance from "@css-atlas/shared/contracts/attendance";
import { getEffectiveScholarId } from "@css-atlas/shared/auth";
import * as sessionLogs from "@css-atlas/shared/contracts/session-logs";
import * as users from "@css-atlas/shared/contracts/users";
import type { ScholarInRoom, ScholarNoShow, ScholarWithCompletedSession, SessionLogRow } from "@css-atlas/shared/contracts/session-logs";
import type { MemoUserRow, TeamLeaderRow } from "@css-atlas/shared/contracts/users";
import type {
  SessionType,
  CleanedAndErroredResult,
  CleanedAndErroredOptions,
  ScholarsInRoomOptions,
} from "@/lib/types/session-log";
import type {
  AttendanceKind,
  AttendanceWeekBoard,
  AttendanceForUids,
  ScholarWeekExcuse,
} from "@css-atlas/shared/contracts/attendance";
import type { RosterRow } from "@/lib/types/roster";
import type { MenteeWithCompliance } from "@/lib/types/supabase";
import type {
  McfPrefill,
  MeetingPreferenceInput,
  MeetingPreferenceOutput,
  MenteeOption,
  MenteeReview,
} from "@/lib/types/mentee-review";
import * as traffic from "@css-atlas/shared/contracts/traffic";
import type { TrafficSession, WeekEntryCount } from "@css-atlas/shared/contracts/traffic";
import * as dailyActivity from "@css-atlas/shared/contracts/daily-activity";
import * as hoursBenchmark from "@css-atlas/shared/contracts/hours-benchmark";
import type {
  McfFormLogRow,
  WahfFormLogRow,
  WplFormLogRow,
  FormLogRowWithLate,
  RecentFormSubmission,
  TeamLeaderFormStatsRow,
} from "@/lib/types/form-log";
import * as tutorReports from "@css-atlas/shared/contracts/tutor-reports";
import type { TutorReportWeekRow } from "@css-atlas/shared/contracts/tutor-reports";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function dateOpts(options?: { startDate?: Date; endDate?: Date; scholarUids?: string[]; sessionType?: string }) {
  return {
    startDate: options?.startDate?.toISOString(),
    endDate: options?.endDate?.toISOString(),
    scholarUids: options?.scholarUids,
    sessionType: options?.sessionType,
  };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function fetchMenteesWithCompliance(
  startDate: Date,
  endDate: Date
): Promise<MenteeWithCompliance[]> {
  const params = new URLSearchParams({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  });
  return backendGet<MenteeWithCompliance[]>(`/api/auth/mentees/compliance?${params}`);
}

type MenteeApiRow = {
  scholar_uid: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

/** GET /api/auth/mentees — the caller's assigned mentees, normalized for the switcher. */
export async function fetchMentees(): Promise<MenteeOption[]> {
  const rows = await backendGet<MenteeApiRow[]>("/api/auth/mentees");
  return rows.flatMap((row) => {
    if (!row.scholar_uid) return [];
    const fullName = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
    return [{ uid: row.scholar_uid, fullName: fullName || "Unknown", email: row.email ?? null }];
  });
}

/** GET /api/auth/mentees/:uid/review — authorized review (own meeting preference included). */
export async function fetchMenteeReview(uid: string, week?: number | null): Promise<MenteeReview> {
  const params = new URLSearchParams();
  if (week != null) params.set("week", String(week));
  const query = params.toString();
  return backendGet<MenteeReview>(
    `/api/auth/mentees/${encodeURIComponent(uid)}/review${query ? `?${query}` : ""}`
  );
}

/**
 * GET /api/auth/mentees/:uid/directory-review — team-leader+ review for any
 * scholar with a mentor assignment (directory detail page).
 */
export async function fetchDirectoryMenteeReview(
  uid: string,
  week?: number | null,
): Promise<MenteeReview> {
  const params = new URLSearchParams();
  if (week != null) params.set("week", String(week));
  const query = params.toString();
  return backendGet<MenteeReview>(
    `/api/auth/mentees/${encodeURIComponent(uid)}/directory-review${query ? `?${query}` : ""}`,
  );
}

/** PUT /api/auth/mentees/:uid/meeting-preference — save the caller's own weekday/time. */
export async function saveMenteeMeetingPreference(
  uid: string,
  input: MeetingPreferenceInput
): Promise<MeetingPreferenceOutput> {
  return backendPut<MeetingPreferenceOutput>(
    `/api/auth/mentees/${encodeURIComponent(uid)}/meeting-preference`,
    input
  );
}

/**
 * GET /api/auth/mentees/:uid/mcf-prefill — fresh click-time prefill for the
 * current week. Call on the user gesture; open the returned URL in a new tab.
 */
export async function fetchMenteeMcfPrefill(uid: string): Promise<McfPrefill> {
  return backendGet<McfPrefill>(`/api/auth/mentees/${encodeURIComponent(uid)}/mcf-prefill`);
}

export async function fetchAllUsersForMemo(): Promise<readonly MemoUserRow[]> {
  return callEndpoint(users.getMemoUsers);
}

export async function getUserByUid(uid: string): Promise<MemoUserRow | null> {
  return callEndpoint(users.getUser, { params: { uid } });
}

export type { RosterRow } from "@/lib/types/roster";

export async function getRosterByUid(uid: string): Promise<RosterRow | null> {
  return backendGet<RosterRow | null>(`/api/dev/roster/${encodeURIComponent(uid)}`);
}

export async function fetchTeamLeaders(): Promise<readonly TeamLeaderRow[]> {
  return callEndpoint(users.getTeamLeaders);
}

// ---------------------------------------------------------------------------
// Session logs
// ---------------------------------------------------------------------------

export async function fetchFrontDeskLogs(options?: {
  startDate?: Date; endDate?: Date; scholarUids?: string[]; sessionType?: SessionType | string;
}): Promise<readonly SessionLogRow[]> {
  return callEndpoint(sessionLogs.getFrontDeskLogs, { body: dateOpts(options) });
}

export async function fetchStudySessionLogs(options?: {
  startDate?: Date; endDate?: Date; scholarUids?: string[]; sessionType?: SessionType | string;
}): Promise<readonly SessionLogRow[]> {
  return callEndpoint(sessionLogs.getStudyLogs, { body: dateOpts(options) });
}

export async function getFrontDeskCleanedAndErrored(
  options?: { startDate?: Date; endDate?: Date; scholarUids?: string[]; sessionType?: SessionType | string; } & CleanedAndErroredOptions
): Promise<CleanedAndErroredResult> {
  const raw = await callEndpoint(sessionLogs.getFrontDeskCleaned, {
    body: { ...dateOpts(options), treatUnclosedEntryAsError: options?.treatUnclosedEntryAsError },
  });
  return { ...raw, byScholarUid: new Map(Object.entries(raw.byScholarUid)) };
}

export async function getFrontDeskScholarsInRoom(
  options?: ScholarsInRoomOptions & { startDate?: Date; endDate?: Date; scholarUids?: string[] }
): Promise<readonly ScholarInRoom[]> {
  return callEndpoint(sessionLogs.getFrontDeskInRoom, {
    body: { ...dateOpts(options), asOf: options?.asOf?.toISOString() },
  });
}

export async function getFrontDeskCompletedSessions(options?: {
  startDate?: Date; endDate?: Date; scholarUids?: string[]; sessionType?: SessionType | string;
}): Promise<readonly ScholarWithCompletedSession[]> {
  return callEndpoint(sessionLogs.getFrontDeskCompleted, { body: dateOpts(options) });
}

export async function getStudySessionCleanedAndErrored(
  options?: { startDate?: Date; endDate?: Date; scholarUids?: string[]; sessionType?: string; } & CleanedAndErroredOptions
): Promise<CleanedAndErroredResult> {
  const raw = await callEndpoint(sessionLogs.getStudyCleaned, {
    body: { ...dateOpts(options), treatUnclosedEntryAsError: options?.treatUnclosedEntryAsError },
  });
  return { ...raw, byScholarUid: new Map(Object.entries(raw.byScholarUid)) };
}

export async function getStudySessionScholarsInRoom(
  options?: ScholarsInRoomOptions & { startDate?: Date; endDate?: Date; scholarUids?: string[] }
): Promise<readonly ScholarInRoom[]> {
  return callEndpoint(sessionLogs.getStudyInRoom, {
    body: { ...dateOpts(options), asOf: options?.asOf?.toISOString() },
  });
}

export async function getStudySessionCompletedSessions(options?: {
  startDate?: Date; endDate?: Date; scholarUids?: string[]; sessionType?: string;
}): Promise<readonly ScholarWithCompletedSession[]> {
  return callEndpoint(sessionLogs.getStudyCompleted, { body: dateOpts(options) });
}

export async function getStudySessionNoShows(): Promise<readonly ScholarNoShow[]> {
  return callEndpoint(sessionLogs.getStudyNoShows);
}

export async function getFrontDeskNoShows(): Promise<readonly ScholarNoShow[]> {
  return callEndpoint(sessionLogs.getFrontDeskNoShows);
}

// ---------------------------------------------------------------------------
// Attendance (campus week — tickets + scholar_week_excuses)
// ---------------------------------------------------------------------------

export async function getAttendanceWeekBoard(
  weekNum: number,
  kind: AttendanceKind
): Promise<AttendanceWeekBoard> {
  return callEndpoint(attendance.getWeekBoard, { params: { week_num: weekNum }, query: { kind } });
}

export async function fetchAttendanceForUids(
  weekNum: number,
  uids: string[]
): Promise<AttendanceForUids> {
  if (uids.length === 0) {
    return { week_num: weekNum, week_start: "", rows: [] };
  }
  return callEndpoint(attendance.getWeekAttendanceForUids, { params: { week_num: weekNum }, body: { uids } });
}

export async function upsertAttendanceExcuse(
  excuse: EndpointRequest<typeof attendance.upsertExcuse>["body"]
): Promise<ScholarWeekExcuse> {
  return callEndpoint(attendance.upsertExcuse, { body: excuse });
}

// ---------------------------------------------------------------------------
// Tutor reports (campus week — session `date`, then `start_time`)
// ---------------------------------------------------------------------------

export async function getTutorReportWeekRows(weekNum: number): Promise<readonly TutorReportWeekRow[]> {
  return callEndpoint(tutorReports.getWeek, { params: { week_num: weekNum } });
}

export async function deleteTutorReport(id: number): Promise<{ readonly id: number }> {
  return callEndpoint(tutorReports.remove, { params: { id } });
}

// ---------------------------------------------------------------------------
// Traffic
// ---------------------------------------------------------------------------

export type { WeekEntryCount };

export async function getTrafficSessionsForWeek(weekNumber: number): Promise<readonly TrafficSession[]> {
  return callEndpoint(traffic.getSessionsForWeek, { params: { week_num: weekNumber } });
}

export async function getTrafficEntryCountForWeek(weekNumber: number): Promise<number> {
  return callEndpoint(traffic.getEntryCountForWeek, { params: { week_num: weekNumber } });
}

export async function getTrafficEntryCountsForWeeks(weekNumbers: ReadonlyArray<number>): Promise<readonly WeekEntryCount[]> {
  if (weekNumbers.length === 0) return [];
  return callEndpoint(traffic.getEntryCountsForWeeks, { body: { weekNumbers } });
}

// ---------------------------------------------------------------------------
// Form logs
// ---------------------------------------------------------------------------

export type WahfFormLogRowWithLate = FormLogRowWithLate<WahfFormLogRow>;
export type McfFormLogRowWithLate = FormLogRowWithLate<McfFormLogRow>;
export type WplFormLogRowWithLate = FormLogRowWithLate<WplFormLogRow>;

export async function getMcfFormLogsForWeek(weekNum: number) { return backendGet<McfFormLogRow[]>(`/api/form-logs/mcf/week/${weekNum}`); }
export async function getMcfFormLogsByUid(uid: string) { return backendGet<McfFormLogRow[]>(`/api/form-logs/mcf/uid/${encodeURIComponent(uid)}`); }
export async function getMcfFormLogsByUidAndWeek(uid: string, weekNum: number) { return backendGet<McfFormLogRow[]>(`/api/form-logs/mcf/uid/${encodeURIComponent(uid)}/week/${weekNum}`); }
export async function getWhafFormLogsForWeek(weekNum: number) { return backendGet<WahfFormLogRow[]>(`/api/form-logs/whaf/week/${weekNum}`); }
export async function getWhafFormLogsByUid(uid: string) { return backendGet<WahfFormLogRow[]>(`/api/form-logs/whaf/uid/${encodeURIComponent(uid)}`); }
export async function getWplFormLogsForWeek(weekNum: number) { return backendGet<WplFormLogRow[]>(`/api/form-logs/wpl/week/${weekNum}`); }
export async function getWplFormLogsByUid(uid: string) { return backendGet<WplFormLogRow[]>(`/api/form-logs/wpl/uid/${encodeURIComponent(uid)}`); }
export async function getWplFormLogsByUidAndWeek(uid: string, weekNum: number) { return backendGet<WplFormLogRow[]>(`/api/form-logs/wpl/uid/${encodeURIComponent(uid)}/week/${weekNum}`); }

export async function getWhafFormLogsForWeekWithLate(weekNum: number) { return backendGet<WahfFormLogRowWithLate[]>(`/api/form-logs/whaf/week/${weekNum}/with-late`); }
export async function getMcfFormLogsForWeekWithLate(weekNum: number) { return backendGet<McfFormLogRowWithLate[]>(`/api/form-logs/mcf/week/${weekNum}/with-late`); }
export async function getMcfFormLogsByUidWithLate(uid: string) { return backendGet<McfFormLogRowWithLate[]>(`/api/form-logs/mcf/uid/${encodeURIComponent(uid)}/with-late`); }
export async function getMcfFormLogsByUidAndWeekWithLate(uid: string, weekNum: number) { return backendGet<McfFormLogRowWithLate[]>(`/api/form-logs/mcf/uid/${encodeURIComponent(uid)}/week/${weekNum}/with-late`); }
export async function getWplFormLogsForWeekWithLate(weekNum: number) { return backendGet<WplFormLogRowWithLate[]>(`/api/form-logs/wpl/week/${weekNum}/with-late`); }
export async function getWplFormLogsByUidWithLate(uid: string) { return backendGet<WplFormLogRowWithLate[]>(`/api/form-logs/wpl/uid/${encodeURIComponent(uid)}/with-late`); }
export async function getWplFormLogsByUidAndWeekWithLate(uid: string, weekNum: number) { return backendGet<WplFormLogRowWithLate[]>(`/api/form-logs/wpl/uid/${encodeURIComponent(uid)}/week/${weekNum}/with-late`); }

export type { TeamLeaderFormStatsRow };

export async function getTeamLeaderFormStatsForWeek(weekNumber: number): Promise<TeamLeaderFormStatsRow[]> {
  return backendPost("/api/form-logs/team-leader-stats", { weekNumber });
}

export function scholarIdFromProfile(profile: { student_id?: unknown } | null): string | null {
  return getEffectiveScholarId(profile);
}

/** @deprecated Use scholarIdFromProfile */
export const scholarUidFromProfile = scholarIdFromProfile;

export async function getRecentFormSubmissions(params: {
  profile: { student_id?: string | null } | null;
}): Promise<RecentFormSubmission[]> {
  const scholarId = scholarIdFromProfile(params.profile);
  if (!scholarId) return [];
  return backendPost("/api/form-logs/recent-submissions", { scholarId });
}

// ---------------------------------------------------------------------------
// Daily scholar activity
// ---------------------------------------------------------------------------

export async function getTotalMinutesForMenteeWeek(params: {
  menteeUid: string; weekNum: number; logSource: string;
}): Promise<number> {
  return callEndpoint(dailyActivity.getMinutes, { query: params });
}

export async function getWeeklyMemoPdf(weekNumber: number): Promise<Response> {
  return backendDownload(`/api/memo/pdf?weekNumber=${weekNumber}`);
}

export async function getHoursBenchmarkReport() {
  return callEndpoint(hoursBenchmark.getReport);
}
