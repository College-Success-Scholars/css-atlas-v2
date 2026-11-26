/**
 * @file form-log.service.ts
 * @module backend/services
 *
 * Form submission log access and aggregation service.
 * Handles all three form types: MCF (Mentee Check-in Form),
 * WAHF (Weekly Academic Health Form), and WPL (Weekly Performance Log).
 * Provides individual lookups, batch queries by multiple UIDs, late submission
 * filtering, and team leader performance stat aggregation.
 *
 * ## Responsibilities
 * - Fetch MCF/WAHF/WPL logs by weekNum, uid, or batch of uids
 * - Filter by late submission status
 * - Aggregate submission stats for team leaders
 * - Get recent form submissions for a scholar profile
 *
 * ## What belongs here
 * - All Supabase queries on form log tables (mcf_form_logs, wahf_form_logs, wpl_form_logs)
 * - Form log aggregation and stat computation
 *
 * ## What does NOT belong here
 * - Form display formatting (that's frontend lib/format/)
 * - HTTP request/response logic
 */
import { getSupabaseClient } from "../supabase/client.js";
import { isLate, type RequiredForm } from "@css-atlas/shared/form-status";
import { campusWeekToDateRange, dateToCampusWeek, getWeekFetchEnd, ONE_DAY_MS } from "./time.service.js";
import type {
  McfFormLogRow,
  WahfFormLogRow,
  WplFormLogRow,
  FormLogRowWithLate,
  RecentFormSubmission,
  TeamLeaderNameRecord,
  TeamLeaderFormStatsRow,
} from "../models/form-log.model.js";
import type { ProfilesRow } from "../models/user.model.js";

// ---------------------------------------------------------------------------
// Late-marking (pure). Deadlines and lateness live in @css-atlas/shared/form-status.
// ---------------------------------------------------------------------------

/** Flag each row late against campus week `weekNum`, or against the week it was submitted in. */
function markFormLogsLate<T extends { created_at: string | null }>(
  form: RequiredForm,
  rows: T[],
  weekNum?: number
): FormLogRowWithLate<T>[] {
  return rows.map((row) => ({ ...row, isLate: row.created_at ? isLate(form, row.created_at, weekNum) : false }));
}

// ---------------------------------------------------------------------------
// Name matching (pure)
// ---------------------------------------------------------------------------

export function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ").replace(/[,.]/g, " ").replace(/\s+/g, " ").trim();
}

export function nameVariants(s: string): string[] {
  const n = normalizeName(s);
  const out = [n];
  const parts = n.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 2) {
    const reversed = [parts[1], parts[0]].join(" ");
    if (reversed !== n) out.push(reversed);
  }
  return out;
}

export function nameTokens(s: string): Set<string> {
  return new Set(normalizeName(s).split(" ").filter(Boolean));
}

export function findTeamLeaderUidByFuzzyName(
  name: string,
  teamLeaders: TeamLeaderNameRecord[]
): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const inputTokens = nameTokens(trimmed);
  let bestUid: string | null = null;
  let bestScore = 0;
  for (const u of teamLeaders) {
    const full = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
    if (!full) continue;
    const fullNorm = normalizeName(full);
    for (const variant of nameVariants(trimmed)) {
      if (fullNorm === variant) return u.uid;
    }
    const tlTokens = nameTokens(full);
    const intersection = [...inputTokens].filter((t) => tlTokens.has(t)).length;
    const union = new Set([...inputTokens, ...tlTokens]).size;
    const score = union > 0 ? intersection / union : 0;
    if (score > bestScore && score >= 0.4) {
      bestScore = score;
      bestUid = u.uid;
    }
  }
  return bestUid;
}

// ---------------------------------------------------------------------------
// Supabase fetch — MCF
// ---------------------------------------------------------------------------

export async function getMcfFormLogsForWeek(weekNum: number): Promise<McfFormLogRow[]> {
  const range = campusWeekToDateRange(weekNum);
  if (!range) return [];
  const supabase = getSupabaseClient();
  const endDate = getWeekFetchEnd(range);
  const { data, error } = await supabase
    .from("mcf_form_logs").select("*")
    .gte("created_at", range.startDate.toISOString())
    .lte("created_at", endDate.toISOString())
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as McfFormLogRow[];
}

export async function getMcfFormLogsByUid(uid: string): Promise<McfFormLogRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("mcf_form_logs").select("*")
    .or(`mentor_uid.eq.${uid},mentee_uid.eq.${uid}`)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as McfFormLogRow[];
}

// ---------------------------------------------------------------------------
// Supabase fetch — WAHF
// ---------------------------------------------------------------------------

export async function getWhafFormLogsForWeek(weekNum: number): Promise<WahfFormLogRow[]> {
  const range = campusWeekToDateRange(weekNum);
  if (!range) return [];
  const supabase = getSupabaseClient();
  const endDate = getWeekFetchEnd(range);
  const { data, error } = await supabase
    .from("whaf_form_logs").select("*")
    .gte("created_at", range.startDate.toISOString())
    .lte("created_at", endDate.toISOString())
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as WahfFormLogRow[];
}

export async function getWhafFormLogsByUid(uid: string): Promise<WahfFormLogRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("whaf_form_logs").select("*")
    .eq("scholar_uid", uid)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as WahfFormLogRow[];
}

// ---------------------------------------------------------------------------
// Supabase fetch — WPL
// ---------------------------------------------------------------------------

export async function getWplFormLogsForWeek(weekNum: number): Promise<WplFormLogRow[]> {
  const range = campusWeekToDateRange(weekNum);
  if (!range) return [];
  const supabase = getSupabaseClient();
  const endDate = getWeekFetchEnd(range);
  const { data, error } = await supabase
    .from("wpl_form_logs").select("*")
    .gte("created_at", range.startDate.toISOString())
    .lte("created_at", endDate.toISOString())
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as WplFormLogRow[];
}

export async function getWplFormLogsByUid(uid: string): Promise<WplFormLogRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("wpl_form_logs").select("*")
    .eq("scholar_uid", uid)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as WplFormLogRow[];
}

// ---------------------------------------------------------------------------
// With-late fetchers
// ---------------------------------------------------------------------------

export async function getWhafFormLogsForWeekWithLate(weekNum: number) {
  const rows = await getWhafFormLogsForWeek(weekNum);
  return markFormLogsLate("WAHF", rows, weekNum);
}

export async function getMcfFormLogsForWeekWithLate(weekNum: number) {
  const rows = await getMcfFormLogsForWeek(weekNum);
  return markFormLogsLate("MCF", rows, weekNum);
}

export async function getWplFormLogsForWeekWithLate(weekNum: number) {
  const rows = await getWplFormLogsForWeek(weekNum);
  return markFormLogsLate("WPL", rows, weekNum);
}

// ---------------------------------------------------------------------------
// Aggregate: team leader form stats
// ---------------------------------------------------------------------------

const NO_SUBMISSION_SENTINEL = "9999-12-31T23:59:59.999Z";

/** Roster sentinel: team leader has no mentor_mentee row yet. */
export const NO_MENTEE_RELATIONSHIP = -1;

/** Required form count for totals: treat the no-relationship sentinel as zero owed. */
export function countableFormRequired(required: number): number {
  return Math.max(0, required);
}

type TeamLeaderInput = {
  uid: string;
  first_name: string | null;
  last_name: string | null;
  program_role: string | null;
  mentee_count: number | null;
};

export function buildTeamLeaderFormStatsForWeek(
  teamLeaders: TeamLeaderInput[],
  mcfRowsWithLate: FormLogRowWithLate<McfFormLogRow>[],
  whafRowsWithLate: FormLogRowWithLate<WahfFormLogRow>[],
  wplRowsWithLate: FormLogRowWithLate<WplFormLogRow>[]
): TeamLeaderFormStatsRow[] {
  const tlUids = new Set(teamLeaders.map((u) => u.uid));

  const mcfByUid = new Map<string, { count: number; hasLate: boolean; latestAt: string }>();
  for (const row of mcfRowsWithLate) {
    const mentorUid = row.mentor_uid ?? null;
    if (mentorUid) {
      const cur = mcfByUid.get(mentorUid) ?? { count: 0, hasLate: false, latestAt: "" };
      const created = row.created_at ?? "";
      mcfByUid.set(mentorUid, {
        count: cur.count + 1,
        hasLate: cur.hasLate || row.isLate,
        latestAt: created > cur.latestAt ? created : cur.latestAt,
      });
    }
  }

  const whafByUid = new Map<string, { count: number; hasLate: boolean; latestAt: string }>();
  for (const u of teamLeaders) whafByUid.set(u.uid, { count: 0, hasLate: false, latestAt: "" });
  for (const row of whafRowsWithLate) {
    const uid = row.scholar_uid && tlUids.has(row.scholar_uid) ? row.scholar_uid : null;
    if (!uid) continue;
    const cur = whafByUid.get(uid)!;
    const created = row.created_at ?? "";
    whafByUid.set(uid, {
      count: cur.count + 1,
      hasLate: cur.hasLate || row.isLate,
      latestAt: created > cur.latestAt ? created : cur.latestAt,
    });
  }

  const wplByUid = new Map<string, { count: number; hasLate: boolean; latestAt: string }>();
  for (const u of teamLeaders) wplByUid.set(u.uid, { count: 0, hasLate: false, latestAt: "" });
  for (const row of wplRowsWithLate) {
    const uid = row.scholar_uid && tlUids.has(row.scholar_uid) ? row.scholar_uid : null;
    if (!uid) continue;
    const cur = wplByUid.get(uid)!;
    const created = row.created_at ?? "";
    wplByUid.set(uid, {
      count: cur.count + 1,
      hasLate: cur.hasLate || row.isLate,
      latestAt: created > cur.latestAt ? created : cur.latestAt,
    });
  }

  return teamLeaders.map((u) => {
    const menteeCount = u.mentee_count ?? 0;
    const mcf = mcfByUid.get(u.uid) ?? { count: 0, hasLate: false, latestAt: "" };
    const whaf = whafByUid.get(u.uid) ?? { count: 0, hasLate: false, latestAt: "" };
    const wpl = wplByUid.get(u.uid) ?? { count: 0, hasLate: false, latestAt: "" };
    const mcf_required = menteeCount;
    const mcf_completed = mcf.count;
    const mcfOwed = countableFormRequired(mcf_required);
    const mcf_pct = mcfOwed > 0 ? Math.round((mcf_completed / mcfOwed) * 100) : 100;
    const whaf_required = 1;
    const whaf_completed = whaf.count;
    const whaf_pct = whaf_completed >= whaf_required ? 100 : Math.round((whaf_completed / whaf_required) * 100);
    const wpl_required = 1;
    const wpl_completed = wpl.count;
    const wpl_pct = wpl_completed >= wpl_required ? 100 : Math.round((wpl_completed / wpl_required) * 100);
    return {
      scholarId: u.uid,
      name: [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || u.uid,
      programRole: u.program_role,
      mcfCompleted: mcf_completed, mcfRequired: mcf_required, mcfLate: mcf.hasLate, mcfPct: mcf_pct,
      mcfLatestAt: mcf.latestAt || (mcfOwed > 0 ? NO_SUBMISSION_SENTINEL : ""),
      wahfCompleted: whaf_completed, wahfRequired: whaf_required, wahfLate: whaf.hasLate, wahfPct: whaf_pct,
      wahfLatestAt: whaf.latestAt || NO_SUBMISSION_SENTINEL,
      wplCompleted: wpl_completed, wplRequired: wpl_required, wplLate: wpl.hasLate, wplPct: wpl_pct,
      wplLatestAt: wpl.latestAt || NO_SUBMISSION_SENTINEL,
    };
  });
}

// ---------------------------------------------------------------------------
// Batch fetch by UIDs
// ---------------------------------------------------------------------------

export async function getWhafFormLogsByUids(uids: ReadonlyArray<string>): Promise<WahfFormLogRow[]> {
  if (!uids.length) return [];
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("whaf_form_logs").select("*").in("scholar_uid", uids);
  if (error) throw error;
  return (data ?? []) as WahfFormLogRow[];
}

export async function getMcfFormLogsByUids(
  uids: ReadonlyArray<string>,
  field: "mentor_uid" | "mentee_uid" = "mentor_uid"
): Promise<McfFormLogRow[]> {
  if (!uids.length) return [];
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("mcf_form_logs").select("*").in(field, uids);
  if (error) throw error;
  return (data ?? []) as McfFormLogRow[];
}

export async function getWplFormLogsByUids(uids: ReadonlyArray<string>): Promise<WplFormLogRow[]> {
  if (!uids.length) return [];
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("wpl_form_logs").select("*").in("scholar_uid", uids);
  if (error) throw error;
  return (data ?? []) as WplFormLogRow[];
}

// ---------------------------------------------------------------------------
// Single form log by ID
// ---------------------------------------------------------------------------

export async function getMcfFormLogById(id: string): Promise<McfFormLogRow | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("mcf_form_logs").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data ?? null) as McfFormLogRow | null;
}

export async function getWplFormLogById(id: number): Promise<WplFormLogRow | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("wpl_form_logs").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data ?? null) as WplFormLogRow | null;
}

// ---------------------------------------------------------------------------
// Recent form submissions
// ---------------------------------------------------------------------------

export function scholarUidFromProfile(profile: ProfilesRow | null): string | null {
  const id = profile?.student_id;
  if (typeof id === "string" && id.trim() !== "") return id.trim();
  return null;
}

function sortByCreatedAtDesc<T extends { created_at: string | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aTs = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTs = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bTs - aTs;
  });
}

function mapWhafRow(row: WahfFormLogRow): RecentFormSubmission {
  return {
    id: `WAHF-${row.id}`, formType: "WAHF", submittedAt: row.created_at,
    assignment_grades: row.assignment_grades, course_changes: row.course_changes,
    missed_classes: row.missed_classes, missed_assignments: row.missed_assignments,
    course_change_details: row.course_change_details,
  };
}

/** Scholar home: WAHF id + timestamp only — no grades or team-leader form payloads. */
export function mapWhafSummaryRow(row: WahfFormLogRow): RecentFormSubmission {
  return {
    id: `WAHF-${row.id}`,
    formType: "WAHF",
    submittedAt: row.created_at,
  };
}

export function assembleRecentFormSubmissions(params: {
  whaf: WahfFormLogRow[];
  wpl: WplFormLogRow[];
  mcf: McfFormLogRow[];
  includeTeamLeaderForms: boolean;
}): RecentFormSubmission[] {
  if (!params.includeTeamLeaderForms) {
    return sortByCreatedAtDesc(params.whaf).map(mapWhafSummaryRow);
  }

  return [
    ...sortByCreatedAtDesc(params.whaf).map(mapWhafRow),
    ...sortByCreatedAtDesc(params.wpl).map(mapWplRow),
    ...sortByCreatedAtDesc(params.mcf).map(mapMcfRow),
  ].sort((a, b) => {
    const aTs = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
    const bTs = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
    return bTs - aTs;
  });
}

function mapWplRow(row: WplFormLogRow): RecentFormSubmission {
  return {
    id: `WPL-${row.id}`, formType: "WPL", submittedAt: row.created_at,
    hours_worked: row.hours_worked, projects: row.projects,
    met_with_all: row.met_with_all, explanation: row.explanation,
  };
}

function mapMcfRow(row: McfFormLogRow): RecentFormSubmission {
  return {
    id: `MCF-${row.id}`, formType: "MCF", submittedAt: row.created_at,
    mentee_name: row.mentee_name, meeting_date: row.meeting_date,
    meeting_time: row.meeting_time, met_in_person: row.met_in_person,
    tasks_completed: row.tasks_completed, meeting_notes: row.meeting_notes,
    needs_tutor: row.needs_tutor,
  };
}

export async function getRecentFormSubmissions(params: {
  profile?: ProfilesRow | null;
  scholarId?: string | null;
  includeTeamLeaderForms?: boolean;
}): Promise<RecentFormSubmission[]> {
  const uid = params.scholarId ?? scholarUidFromProfile(params.profile ?? null);
  if (!uid) return [];

  const includeTeamLeaderForms = params.includeTeamLeaderForms === true;
  if (!includeTeamLeaderForms) {
    const whafAll = await getWhafFormLogsByUid(uid);
    return assembleRecentFormSubmissions({
      whaf: whafAll,
      wpl: [],
      mcf: [],
      includeTeamLeaderForms: false,
    });
  }

  const [whafAll, wplAll, mcfAll] = await Promise.all([
    getWhafFormLogsByUid(uid),
    getWplFormLogsByUid(uid),
    getMcfFormLogsByUid(uid),
  ]);

  return assembleRecentFormSubmissions({
    whaf: whafAll,
    wpl: wplAll,
    mcf: mcfAll,
    includeTeamLeaderForms: true,
  });
}
