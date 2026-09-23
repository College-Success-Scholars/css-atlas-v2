/**
 * @file data.ts
 * @module frontend/lib/server
 *
 * Typed wrapper functions for every backend API endpoint.
 * This is the preferred way for Server Components and pages to fetch domain data.
 * Each function calls backendGet/backendPost/backendPatch/backendDownload from api-client.ts
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
import { backendGet, backendPost, backendPatch, backendDownload } from "./api-client";
import { getEffectiveScholarId } from "../../../shared/dist/auth.js";
import type {
  SessionLogRow,
  SessionType,
  CleanedAndErroredResult,
  CleanedAndErroredOptions,
  ScholarInRoom,
  ScholarsInRoomOptions,
  ScholarWithCompletedSession,
} from "@/lib/types/session-log";
import type {
  AttendanceKind,
  AttendanceWeekBoard,
  AttendanceForUids,
  ScholarWeekExcuse,
} from "@/lib/types/attendance-week";
import type { RosterRow } from "@/lib/types/roster";
import type { MenteeWithCompliance } from "@/lib/types/supabase";
import type {
  TrafficSession,
  WeekEntryCount,
} from "@/lib/types/traffic";
import type {
  McfFormLogRow,
  WahfFormLogRow,
  WplFormLogRow,
  FormLogRowWithLate,
  RecentFormSubmission,
  TeamLeaderFormStatsRow,
} from "@/lib/types/form-log";

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

export type MemoUserRow = {
  uid: string;
  first_name: string | null;
  last_name: string | null;
  cohort: number | null;
  program_role: string | null;
  app_role: string | null;
  fd_required: number | null;
  ss_required: number | null;
  status: string | null;
};

export type TeamLeaderRow = Omit<MemoUserRow, "app_role"> & {
  mentee_count: number | null;
};

export async function fetchScholarNamesByUids(uids: string[]): Promise<Map<string, string>> {
  if (uids.length === 0) return new Map();
  const data = await backendPost<Record<string, string>>("/api/users/scholar-names", { uids });
  return new Map(Object.entries(data));
}

export async function fetchRequiredHoursByUids(
  uids: string[]
): Promise<Map<string, { fd_required: number | null; ss_required: number | null }>> {
  if (uids.length === 0) return new Map();
  const data = await backendPost<Record<string, { fd_required: number | null; ss_required: number | null }>>("/api/users/required-hours", { uids });
  return new Map(Object.entries(data));
}

export async function fetchEligibleScholarUids(uids: string[]): Promise<Set<string>> {
  if (uids.length === 0) return new Set();
  return new Set(await backendPost<string[]>("/api/users/eligible-scholars", { uids }));
}

export async function fetchAllUserUids(): Promise<string[]> {
  return backendGet<string[]>("/api/users/all-uids");
}

export async function fetchAllUsersForMemo(): Promise<MemoUserRow[]> {
  return backendGet<MemoUserRow[]>("/api/users/memo-users");
}

export async function getUserByUid(uid: string): Promise<MemoUserRow | null> {
  return backendGet<MemoUserRow | null>(`/api/users/${encodeURIComponent(uid)}`);
}

export type { RosterRow } from "@/lib/types/roster";

export async function getRosterByUid(uid: string): Promise<RosterRow | null> {
  return backendGet<RosterRow | null>(`/api/dev/roster/${encodeURIComponent(uid)}`);
}

export async function fetchTeamLeaders(): Promise<TeamLeaderRow[]> {
  return backendGet<TeamLeaderRow[]>("/api/users/team-leaders");
}

export async function fetchScholarUids(): Promise<string[]> {
  return backendGet<string[]>("/api/users/scholar-uids");
}

// ---------------------------------------------------------------------------
// Session logs
// ---------------------------------------------------------------------------

export async function fetchFrontDeskLogs(options?: {
  startDate?: Date; endDate?: Date; scholarUids?: string[]; sessionType?: SessionType | string;
}): Promise<SessionLogRow[]> {
  return backendPost<SessionLogRow[]>("/api/session-logs/front-desk", dateOpts(options));
}

export async function fetchStudySessionLogs(options?: {
  startDate?: Date; endDate?: Date; scholarUids?: string[]; sessionType?: SessionType | string;
}): Promise<SessionLogRow[]> {
  return backendPost<SessionLogRow[]>("/api/session-logs/study", dateOpts(options));
}

export async function getFrontDeskCleanedAndErrored(
  options?: { startDate?: Date; endDate?: Date; scholarUids?: string[]; sessionType?: SessionType | string; } & CleanedAndErroredOptions
) {
  const raw = await backendPost<{ byScholarUid: Record<string, { cleaned: unknown[]; errored: unknown[]; scholarName: string | null }>; allCleaned: unknown[]; allErrored: unknown[] }>(
    "/api/session-logs/front-desk/cleaned",
    { ...dateOpts(options), treatUnclosedEntryAsError: options?.treatUnclosedEntryAsError }
  );
  return { byScholarUid: new Map(Object.entries(raw.byScholarUid)), allCleaned: raw.allCleaned, allErrored: raw.allErrored } as CleanedAndErroredResult;
}

export async function getFrontDeskScholarsInRoom(
  options?: ScholarsInRoomOptions & { startDate?: Date; endDate?: Date; scholarUids?: string[] }
): Promise<ScholarInRoom[]> {
  return backendPost<ScholarInRoom[]>("/api/session-logs/front-desk/in-room", {
    ...dateOpts(options), asOf: options?.asOf?.toISOString(),
  });
}

export async function getFrontDeskCompletedSessions(options?: {
  startDate?: Date; endDate?: Date; scholarUids?: string[]; sessionType?: SessionType | string;
}): Promise<ScholarWithCompletedSession[]> {
  return backendPost<ScholarWithCompletedSession[]>("/api/session-logs/front-desk/completed", dateOpts(options));
}

export async function getStudySessionCleanedAndErrored(
  options?: { startDate?: Date; endDate?: Date; scholarUids?: string[]; sessionType?: string; } & CleanedAndErroredOptions
) {
  const raw = await backendPost<{ byScholarUid: Record<string, unknown>; allCleaned: unknown[]; allErrored: unknown[] }>(
    "/api/session-logs/study/cleaned",
    { ...dateOpts(options), treatUnclosedEntryAsError: options?.treatUnclosedEntryAsError }
  );
  return { byScholarUid: new Map(Object.entries(raw.byScholarUid)), allCleaned: raw.allCleaned, allErrored: raw.allErrored } as CleanedAndErroredResult;
}

export async function getStudySessionScholarsInRoom(
  options?: ScholarsInRoomOptions & { startDate?: Date; endDate?: Date; scholarUids?: string[] }
): Promise<ScholarInRoom[]> {
  return backendPost<ScholarInRoom[]>("/api/session-logs/study/in-room", {
    ...dateOpts(options), asOf: options?.asOf?.toISOString(),
  });
}

export async function getStudySessionCompletedSessions(options?: {
  startDate?: Date; endDate?: Date; scholarUids?: string[]; sessionType?: string;
}): Promise<ScholarWithCompletedSession[]> {
  return backendPost<ScholarWithCompletedSession[]>("/api/session-logs/study/completed", dateOpts(options));
}

// ---------------------------------------------------------------------------
// Attendance (campus week — tickets + scholar_week_excuses)
// ---------------------------------------------------------------------------

export async function getAttendanceWeekBoard(
  weekNum: number,
  kind: AttendanceKind
): Promise<AttendanceWeekBoard> {
  return backendGet(`/api/attendance/week/${weekNum}?kind=${kind}`);
}

export async function fetchAttendanceForUids(
  weekNum: number,
  uids: string[]
): Promise<AttendanceForUids> {
  if (uids.length === 0) {
    return { week_num: weekNum, week_start: "", rows: [] };
  }
  return backendPost<AttendanceForUids>(`/api/attendance/week/${weekNum}/by-uids`, { uids });
}

export async function upsertAttendanceExcuse(payload: {
  uid: string;
  weekNum: number;
  kind: AttendanceKind;
  excuse_min: number | null;
  description: string | null;
}): Promise<ScholarWeekExcuse> {
  return backendPatch("/api/attendance/excuse", payload);
}

// ---------------------------------------------------------------------------
// Traffic
// ---------------------------------------------------------------------------

export type { WeekEntryCount };

export async function getTrafficSessionsForWeek(weekNumber: number): Promise<TrafficSession[]> {
  return backendGet(`/api/traffic/sessions/${weekNumber}`);
}

export async function getTrafficEntryCountForWeek(weekNumber: number): Promise<number> {
  return backendGet(`/api/traffic/entry-count/${weekNumber}`);
}

export async function getTrafficEntryCountsForWeeks(weekNumbers: number[]): Promise<WeekEntryCount[]> {
  if (weekNumbers.length === 0) return [];
  return backendPost("/api/traffic/entry-counts", { weekNumbers });
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
  const { menteeUid, weekNum, logSource } = params;
  return backendGet(`/api/daily-activity/minutes?menteeUid=${encodeURIComponent(menteeUid)}&weekNum=${weekNum}&logSource=${encodeURIComponent(logSource)}`);
}

export async function getWeeklyMemoPdf(weekNumber: number): Promise<Response> {
  return backendDownload(`/api/memo/pdf?weekNumber=${weekNumber}`);
}
