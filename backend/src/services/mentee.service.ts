/**
 * @file mentee.service.ts
 * @module backend/services
 *
 * Mentee relationship service.
 * Fetches assigned mentees and campus-wide mentee → team-leader names from
 * mentor_mentee via the JWT-scoped Supabase client (RLS applies).
 *
 * ## Responsibilities
 * - Read mentor_mentee assignments for the current mentor
 * - Resolve mentee → team-leader display names for weekly memo follow-up
 *
 * ## What belongs here
 * - Mentee relationship queries from Supabase
 *
 * ## What does NOT belong here
 * - Mentee activity data (that's daily-scholar-activity.service.ts)
 * - HTTP request/response logic
 */
import { getSupabaseClient } from "../supabase/client.js";
import type { MenteeRow, MenteeTeamLeaderRow, MenteeWithCompliance } from "../models/mentee.model.js";
import type { ShiftComplianceDateRange } from "../models/session-log.model.js";
import { getShiftComplianceForScholars } from "./session-log.service.js";

/** Follow-up TL column when the scholar has no mentor_mentee row. */
export const UNASSIGNED_TEAM_LEADER = "Unassigned";

type MentorProfileEmbed = {
  student_id: string | null;
  first_name: string | null;
  last_name: string | null;
};

function asMentorProfile(value: unknown): MentorProfileEmbed | null {
  if (value == null) return null;
  const row = Array.isArray(value) ? value[0] : value;
  if (row == null || typeof row !== "object") return null;
  return row as MentorProfileEmbed;
}

function displayName(
  first: string | null | undefined,
  last: string | null | undefined,
): string | null {
  const name = [first, last].filter(Boolean).join(" ").trim();
  return name || null;
}

/** Collapse assignment rows into mentee_uid → team-leader name (comma-joined if several). */
export function teamLeaderLabelByMenteeUid(
  rows: MenteeTeamLeaderRow[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    const menteeUid = row.mentee_uid?.trim();
    const name = row.team_leader_name?.trim();
    if (!menteeUid || !name) continue;
    const existing = map.get(menteeUid);
    if (!existing) {
      map.set(menteeUid, name);
      continue;
    }
    const names = new Set(existing.split(", ").concat(name));
    map.set(
      menteeUid,
      [...names].sort((a, b) => a.localeCompare(b)).join(", "),
    );
  }
  return map;
}

export function teamLeaderLabelForScholar(
  scholarId: string,
  byMenteeUid: Map<string, string>,
): string {
  return byMenteeUid.get(scholarId) ?? UNASSIGNED_TEAM_LEADER;
}

export function menteeTeamLeaderRowsFromAssignments(
  rows: { mentee_uid: string; profiles: unknown }[],
  rosterNameByUid: Map<string, string> = new Map(),
): MenteeTeamLeaderRow[] {
  return rows.map((row) => {
    const profile = asMentorProfile(row.profiles);
    const rosterUid = profile?.student_id?.trim() ?? "";
    const name =
      (rosterUid ? rosterNameByUid.get(rosterUid) : undefined) ??
      displayName(profile?.first_name, profile?.last_name);
    return { mentee_uid: row.mentee_uid, team_leader_name: name };
  });
}

/** Campus-wide mentee → TL names from mentor_mentee. Empty when RLS hides all rows. */
export async function fetchMenteeTeamLeaderNames(): Promise<Map<string, string>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("mentor_mentee")
    .select("mentee_uid, profiles!mentor_mentee_mentor_id_fkey(student_id, first_name, last_name)");
  if (error) throw error;

  const assignments = data ?? [];
  const studentIds = [
    ...new Set(
      assignments
        .map((row) => asMentorProfile(row.profiles)?.student_id?.trim())
        .filter((uid): uid is string => Boolean(uid)),
    ),
  ];

  const rosterNameByUid = new Map<string, string>();
  if (studentIds.length > 0) {
    const { data: rosterRows, error: rosterError } = await supabase
      .from("user_roster")
      .select("uid, first_name, last_name")
      .in("uid", studentIds);
    if (rosterError) throw rosterError;
    for (const roster of rosterRows ?? []) {
      const name = displayName(roster.first_name, roster.last_name);
      if (roster.uid && name) rosterNameByUid.set(String(roster.uid), name);
    }
  }

  return teamLeaderLabelByMenteeUid(
    menteeTeamLeaderRowsFromAssignments(assignments, rosterNameByUid),
  );
}

export async function getMenteesByMentorKey(mentorKey: string): Promise<MenteeRow[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("mentor_mentee")
    .select("mentee_uid, user_roster(first_name, last_name, fd_required, ss_required)")
    .eq("mentor_id", mentorKey);

  if (error) throw error;
  if (!data) return [];

  return data.map((row: Record<string, unknown>) => {
    const roster = row.user_roster as Record<string, unknown> | null;
    return {
      scholar_uid: row.mentee_uid as string | null,
      first_name: (roster?.first_name as string) ?? null,
      last_name: (roster?.last_name as string) ?? null,
      fd_required: roster?.fd_required != null ? Number(roster.fd_required) : null,
      ss_required: roster?.ss_required != null ? Number(roster.ss_required) : null,
    };
  });
}

export async function getMenteesWithComplianceByMentorKey(
  mentorKey: string,
  range: ShiftComplianceDateRange
): Promise<MenteeWithCompliance[]> {
  const mentees = await getMenteesByMentorKey(mentorKey);
  const scholarIds = mentees.flatMap((mentee) => mentee.scholar_uid ? [mentee.scholar_uid] : []);
  const complianceByScholar = await getShiftComplianceForScholars(scholarIds, range);

  return mentees.map((mentee) => {
    const compliance = mentee.scholar_uid ? complianceByScholar.get(mentee.scholar_uid) : undefined;
    return {
      ...mentee,
      fdCompliance: compliance?.fdCompliance ?? null,
      ssCompliance: compliance?.ssCompliance ?? null,
    };
  });
}

/** @deprecated Use getMenteesByMentorKey */
export async function getMyMentees(mentorId: string): Promise<MenteeRow[]> {
  return getMenteesByMentorKey(mentorId);
}
