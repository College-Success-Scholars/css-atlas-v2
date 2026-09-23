/**
 * @file user.service.ts
 * @module backend/services
 *
 * User and scholar data access service.
 * Fetches user profiles, roles, required hours, eligibility status, and
 * team leader metadata from Supabase. All queries are RLS-scoped via
 * getSupabaseClient().
 *
 * ## Responsibilities
 * - Fetch scholar display names by UID array
 * - Fetch required front-desk and study-session hours per scholar
 * - Filter UIDs to eligible scholars (enrolled freshman/sophomore with hours)
 * - Fetch all user UIDs, memo users, team leaders, enrolled scholar UIDs
 * - Get a single user's data by UID
 * - Developer roster get/update (dual-write profiles + mentee assignments)
 *
 * ## What belongs here
 * - All Supabase queries on profiles, user_roster tables
 * - User-related data transformations (mapping, filtering)
 *
 * ## What does NOT belong here
 * - HTTP request/response logic
 * - Authentication (that's auth.controller.ts)
 */
import { getSupabaseClient } from "../supabase/client.js";
import type { Database } from "../supabase/database.types.js";
import type {
  DirectoryFacets,
  DirectoryGroup,
  DirectoryPagination,
  DirectoryPerson,
  DirectoryQuery,
  DirectoryResponse,
  DirectorySort,
  MemoUserRow,
  RosterPatch,
  RosterRow,
  TeamLeaderRow,
} from "../models/user.model.js";
import { isHourEligibleCohort } from "./time.service.js";

/** Writable profiles insert — excludes generated `full_name` and server `created_at`. */
type ScholarProfileInsert = Omit<
  Database["public"]["Tables"]["profiles"]["Insert"],
  "full_name" | "created_at"
>;

function uniqueNonEmptyStrings(values: string[]): string[] {
  return [...new Set(values)].filter(Boolean);
}

export const ENROLLED_STATUS = "enrolled";
export const GRADUATED_STATUS = "graduated";

type DirectorySourceRow = Pick<
  Database["public"]["Tables"]["user_roster"]["Row"],
  "id" | "first_name" | "last_name" | "email" | "cohort" | "teams" | "program_role" | "phone_number"
> & {
  /** Search-only: never copied onto the mapped DirectoryPerson returned to clients. */
  uid?: string | null;
};

type DirectoryCursor = { name: string; id: string };

export class DirectoryCursorError extends Error {}

function directoryName(row: Pick<DirectorySourceRow, "first_name" | "last_name">): string {
  return [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "Unnamed person";
}

export function mapDirectoryPerson(row: DirectorySourceRow): DirectoryPerson {
  return {
    id: String(row.id),
    name: directoryName(row),
    cohort: row.cohort == null ? null : Number(row.cohort),
    email: row.email ?? null,
    phoneNumber: row.phone_number ?? null,
    teams: [...new Set((row.teams ?? []).map((team) => team.trim()).filter(Boolean))],
    programRole: row.program_role ?? null,
  };
}

export function encodeDirectoryCursor(cursor: DirectoryCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeDirectoryCursor(value: string): DirectoryCursor {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      parsed == null ||
      typeof parsed !== "object" ||
      typeof (parsed as DirectoryCursor).name !== "string" ||
      typeof (parsed as DirectoryCursor).id !== "string" ||
      !(parsed as DirectoryCursor).name ||
      !(parsed as DirectoryCursor).id
    ) throw new Error("invalid cursor");
    return parsed as DirectoryCursor;
  } catch {
    throw new DirectoryCursorError("Invalid directory cursor");
  }
}

function compareDirectoryPeople(a: DirectoryPerson, b: DirectoryPerson, sort: DirectorySort): number {
  const nameOrder = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  const idOrder = a.id.localeCompare(b.id, undefined, { numeric: true });
  const order = nameOrder || idOrder;
  return sort === "asc" ? order : -order;
}

function paginateDirectoryPeople(
  people: DirectoryPerson[],
  query: Pick<DirectoryQuery, "cursor" | "limit" | "sort">,
): { members: DirectoryPerson[]; pagination: DirectoryPagination } {
  let offset = 0;
  if (query.cursor) {
    const cursor = decodeDirectoryCursor(query.cursor);
    const cursorIndex = people.findIndex((person) => person.id === cursor.id && person.name === cursor.name);
    if (cursorIndex === -1) throw new DirectoryCursorError("Stale directory cursor");
    offset = cursorIndex + 1;
  }
  const members = people.slice(offset, offset + query.limit);
  const hasNext = offset + members.length < people.length;
  const last = members.at(-1);
  return {
    members,
    pagination: {
      total: people.length,
      range: { start: members.length ? offset + 1 : 0, end: offset + members.length },
      hasNext,
      nextCursor: hasNext && last ? encodeDirectoryCursor({ name: last.name, id: last.id }) : null,
    },
  };
}

function belongsToGroup(person: DirectoryPerson, group: string): boolean {
  return group === "Unassigned" ? person.teams.length === 0 : person.teams.includes(group);
}

/** Matches the directory search box's "name, email, or UID" contract without exposing UID on the mapped person. */
function matchesDirectorySearch(row: DirectorySourceRow, person: DirectoryPerson, search: string): boolean {
  if (!search) return true;
  const haystack = `${person.name} ${person.email ?? ""} ${row.uid ?? ""}`.toLocaleLowerCase();
  return haystack.includes(search);
}

/** Applies directory filtering and pagination after the RLS-scoped, restricted projection is read. */
export function queryDirectoryRows(rows: DirectorySourceRow[], query: DirectoryQuery): DirectoryResponse {
  const search = query.search.toLocaleLowerCase();
  const people = rows
    .map((row) => ({ row, person: mapDirectoryPerson(row) }))
    .filter(({ row, person }) =>
      matchesDirectorySearch(row, person, search) &&
      (!query.teams.length || person.teams.some((team) => query.teams.includes(team))) &&
      (!query.programRoles.length || (person.programRole != null && query.programRoles.includes(person.programRole))) &&
      (!query.cohorts.length || (person.cohort != null && query.cohorts.includes(person.cohort))),
    )
    .map(({ person }) => person)
    .sort((a, b) => compareDirectoryPeople(a, b, query.sort));

  if (query.view === "flat") {
    const { members, pagination } = paginateDirectoryPeople(people, query);
    return { view: "flat", members, pagination };
  }

  const groupNames = query.group
    ? [query.group]
    : [...new Set(people.flatMap((person) => person.teams.length ? person.teams : ["Unassigned"]))]
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  const groups: DirectoryGroup[] = groupNames.map((team) => {
    const members = people.filter((person) => belongsToGroup(person, team));
    const page = paginateDirectoryPeople(members, query);
    return { team, ...page };
  });
  return { view: "grouped", total: people.length, groups };
}

/**
 * Reads only directory-facing columns through the request's RLS-scoped client.
 * Filtering and cursor pagination stay in memory because the roster is small and
 * a compound PostgREST cursor would be less reliable than this deterministic path.
 */
export async function getDirectory(query: DirectoryQuery): Promise<DirectoryResponse> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("user_roster")
    .select("id, first_name, last_name, email, cohort, teams, program_role, phone_number, uid");
  if (error) throw error;
  return queryDirectoryRows(data ?? [], query);
}

/** Distinct team/program-role/cohort values for the Directory filter dropdowns. */
export async function getDirectoryFacets(): Promise<DirectoryFacets> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("user_roster")
    .select("teams, program_role, cohort");
  if (error) throw error;
  const rows = data ?? [];
  const teams = uniqueNonEmptyStrings(rows.flatMap((row) => (row.teams ?? []).map((team) => team.trim())))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  const programRoles = uniqueNonEmptyStrings(rows.map((row) => (row.program_role ?? "").trim()))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  const cohorts = [...new Set(rows.map((row) => row.cohort).filter((cohort): cohort is number => cohort != null))]
    .sort((a, b) => b - a);
  return { teams, programRoles, cohorts };
}

export function isEnrolled(status: string | null | undefined): boolean {
  return (status ?? "").toLowerCase() === ENROLLED_STATUS;
}

export function isGraduated(status: string | null | undefined): boolean {
  return (status ?? "").toLowerCase() === GRADUATED_STATUS;
}

export function isScholarProgramRole(programRole: string | null | undefined): boolean {
  return (programRole ?? "").toLowerCase() === "scholar";
}

/** Scholar roster row whose `user_roster.status` is enrolled. */
export function isEnrolledScholar(
  u: Pick<MemoUserRow, "program_role" | "status">,
): boolean {
  return isScholarProgramRole(u.program_role) && isEnrolled(u.status);
}

export function isEligibleScholar(
  u: Pick<MemoUserRow, "program_role" | "cohort" | "status" | "fd_required" | "ss_required">,
): boolean {
  const fd = u.fd_required != null ? Number(u.fd_required) : 0;
  const ss = u.ss_required != null ? Number(u.ss_required) : 0;
  return isEnrolledScholar(u) && isHourEligibleCohort(u.cohort) && (fd > 0 || ss > 0);
}

/** Roster program_role Coordinator only — does not match Program Coordinator. */
export function isCoordinator(programRole: string | null | undefined): boolean {
  return (programRole ?? "").toLowerCase().trim() === "coordinator";
}

/** Memo / form-stats TLs: not scholar, not Coordinator, and `user_roster.status` is enrolled. */
export function isTeamLeaderForPerformance(
  u: Pick<MemoUserRow, "program_role" | "status">,
): boolean {
  return !isScholarProgramRole(u.program_role) && !isCoordinator(u.program_role) && isEnrolled(u.status);
}

/** Roster app_role is often unset; access control reads profiles.app_role. */
export function overlayRosterAppRoleFromProfile(
  roster: RosterRow,
  profileAppRole: string | null | undefined,
): RosterRow {
  if (roster.app_role || !profileAppRole) return roster;
  return { ...roster, app_role: profileAppRole };
}

function mapMemoUserRow(row: {
  uid: string | null;
  first_name: string | null;
  last_name: string | null;
  cohort: number | null;
  program_role: string | null;
  app_role: string | null;
  fd_required: number | null;
  ss_required: number | null;
  status: string | null;
}): MemoUserRow {
  return {
    uid: String(row.uid),
    first_name: row.first_name ?? null,
    last_name: row.last_name ?? null,
    cohort: row.cohort != null ? Number(row.cohort) : null,
    program_role: row.program_role ?? null,
    app_role: row.app_role ?? null,
    fd_required: row.fd_required != null ? Number(row.fd_required) : null,
    ss_required: row.ss_required != null ? Number(row.ss_required) : null,
    status: row.status ?? null,
  };
}

function mapRosterRow(row: Database["public"]["Tables"]["user_roster"]["Row"]): RosterRow | null {
  if (row.uid == null) return null;
  return {
    id: row.id,
    uid: row.uid,
    created_at: row.created_at,
    first_name: row.first_name ?? null,
    last_name: row.last_name ?? null,
    phone_number: row.phone_number ?? null,
    email: row.email ?? null,
    cohort: row.cohort != null ? Number(row.cohort) : null,
    status: row.status ?? null,
    app_role: row.app_role ?? null,
    program_role: row.program_role ?? null,
    fd_required: row.fd_required != null ? Number(row.fd_required) : null,
    ss_required: row.ss_required != null ? Number(row.ss_required) : null,
    mentee_count: row.mentee_count != null ? Number(row.mentee_count) : null,
    majors: row.majors ?? null,
    minors: row.minors ?? null,
    mentee_uids: Array.isArray(row.mentee_uids)
      ? row.mentee_uids.map((id) => String(id)).filter(Boolean)
      : null,
    teams: row.teams ?? null,
    invite_accepted_at: row.invite_accepted_at ?? null,
    invite_sent_at: row.invite_sent_at ?? null,
  };
}

export async function fetchScholarNamesByUids(
  uids: string[]
): Promise<Map<string, string>> {
  if (uids.length === 0) return new Map();
  const supabase = getSupabaseClient();
  const uniqueUids = uniqueNonEmptyStrings(uids);
  const { data, error } = await supabase
    .from("user_roster")
    .select("uid, first_name, last_name")
    .in("uid", uniqueUids);
  if (error) throw error;
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
    if (row.uid && name) map.set(row.uid, name);
  }
  return map;
}

export async function fetchRequiredHoursByUids(
  uids: string[]
): Promise<Map<string, { fd_required: number | null; ss_required: number | null }>> {
  if (uids.length === 0) return new Map();
  const supabase = getSupabaseClient();
  const uniqueUids = uniqueNonEmptyStrings(uids);
  const { data, error } = await supabase
    .from("user_roster")
    .select("uid, fd_required, ss_required")
    .in("uid", uniqueUids);
  if (error) throw error;
  const map = new Map<string, { fd_required: number | null; ss_required: number | null }>();
  for (const row of data ?? []) {
    if (row.uid != null) {
      const fd = row.fd_required != null ? Number(row.fd_required) : null;
      const ss = row.ss_required != null ? Number(row.ss_required) : null;
      map.set(String(row.uid), { fd_required: fd, ss_required: ss });
    }
  }
  return map;
}

export async function fetchEligibleScholarUids(uids: string[]): Promise<Set<string>> {
  if (uids.length === 0) return new Set();
  const supabase = getSupabaseClient();
  const uniqueUids = uniqueNonEmptyStrings(uids);
  const { data, error } = await supabase
    .from("user_roster")
    .select("uid, program_role, fd_required, ss_required, cohort, status")
    .in("uid", uniqueUids);
  if (error) throw error;
  const eligible = new Set<string>();
  for (const row of data ?? []) {
    if (row.uid == null) continue;
    if (
      isEligibleScholar({
        program_role: row.program_role,
        cohort: row.cohort != null ? Number(row.cohort) : null,
        status: row.status,
        fd_required: row.fd_required != null ? Number(row.fd_required) : null,
        ss_required: row.ss_required != null ? Number(row.ss_required) : null,
      })
    ) {
      eligible.add(String(row.uid));
    }
  }
  return eligible;
}

export async function fetchAllUserUids(): Promise<string[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("user_roster")
    .select("uid")
    .not("uid", "is", null);
  if (error) throw error;
  return uniqueNonEmptyStrings((data ?? []).map((r) => String(r.uid)));
}

export async function fetchAllUsersForMemo(): Promise<MemoUserRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("user_roster")
    .select("uid, first_name, last_name, cohort, program_role, app_role, fd_required, ss_required, status")
    .not("uid", "is", null);
  if (error) throw error;
  return (data ?? []).map((r) => mapMemoUserRow(r));
}

export async function getUserByUid(uid: string): Promise<MemoUserRow | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("user_roster")
    .select("uid, first_name, last_name, cohort, program_role, app_role, fd_required, ss_required, status")
    .eq("uid", uid)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapMemoUserRow(data);
}

/** Non-scholar, non-Coordinator roster rows with enrolled status — feeds Memo team leader compliance. */
export async function fetchTeamLeaders(): Promise<TeamLeaderRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("user_roster")
    .select("uid, first_name, last_name, cohort, program_role, fd_required, ss_required, mentee_count, mentee_uids, status")
    .or("program_role.neq.scholar,program_role.is.null");
  if (error) throw error;
  const rows = (data ?? []).map((r) => ({
    uid: String(r.uid),
    first_name: r.first_name ?? null,
    last_name: r.last_name ?? null,
    cohort: r.cohort != null ? Number(r.cohort) : null,
    program_role: r.program_role ?? null,
    fd_required: r.fd_required != null ? Number(r.fd_required) : null,
    ss_required: r.ss_required != null ? Number(r.ss_required) : null,
    status: r.status ?? null,
    mentee_count: r.mentee_count != null ? Number(r.mentee_count) : null,
    mentee_uids: Array.isArray(r.mentee_uids)
      ? r.mentee_uids.map((id) => String(id)).filter(Boolean)
      : null,
  }));
  return rows.filter(isTeamLeaderForPerformance);
}

/** Enrolled scholar UIDs from `user_roster` (`program_role` scholar, `status` enrolled). */
export async function fetchScholarUids(): Promise<string[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("user_roster")
    .select("uid, program_role, status")
    .ilike("program_role", "scholar");
  if (error) throw error;
  return (data ?? [])
    .filter((r) => r.uid != null && isEnrolledScholar({ program_role: r.program_role, status: r.status }))
    .map((r) => String(r.uid));
}

export async function getRosterByUid(uid: string): Promise<RosterRow | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("user_roster")
    .select("*")
    .eq("uid", uid)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const mapped = mapRosterRow(data);
  if (!mapped) return null;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("app_role")
    .eq("student_id", uid)
    .maybeSingle();
  if (profileError) throw profileError;
  return overlayRosterAppRoleFromProfile(mapped, profile?.app_role);
}

async function replaceMentorMenteeAssignments(
  mentorProfileId: string,
  menteeUids: string[],
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error: deleteError } = await supabase
    .from("mentor_mentee")
    .delete()
    .eq("mentor_id", mentorProfileId);
  if (deleteError) throw deleteError;
  if (menteeUids.length === 0) return;
  const { error: insertError } = await supabase.from("mentor_mentee").insert(
    menteeUids.map((mentee_uid) => ({
      mentor_id: mentorProfileId,
      mentee_uid,
    })),
  );
  if (insertError) throw insertError;
}

export async function updateRosterByUid(uid: string, patch: RosterPatch): Promise<RosterRow> {
  const supabase = getSupabaseClient();
  const rosterUpdate: Database["public"]["Tables"]["user_roster"]["Update"] = { ...patch };
  if (patch.mentee_uids !== undefined) {
    rosterUpdate.mentee_count = patch.mentee_uids?.length ?? 0;
  }

  const { data, error } = await supabase
    .from("user_roster")
    .update(rosterUpdate)
    .eq("uid", uid)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const existing = await getRosterByUid(uid);
    if (!existing) throw new Error("User not found");
    throw new Error(
      "Roster update blocked by RLS. Apply supabase/migrations/20260903053000_developer_write_user_roster.sql on the linked project.",
    );
  }
  const mapped = mapRosterRow(data);
  if (!mapped) throw new Error("User not found");

  const profilePatch: Database["public"]["Tables"]["profiles"]["Update"] = {};
  if (patch.first_name !== undefined) profilePatch.first_name = patch.first_name;
  if (patch.last_name !== undefined) profilePatch.last_name = patch.last_name;
  if (patch.phone_number !== undefined) profilePatch.phone_number = patch.phone_number;
  if (patch.cohort !== undefined) profilePatch.cohort = patch.cohort;
  if (patch.status !== undefined) profilePatch.status = patch.status;
  if (patch.program_role !== undefined) profilePatch.program_role = patch.program_role;
  if (patch.fd_required !== undefined) profilePatch.fd_required = patch.fd_required;
  if (patch.ss_required !== undefined) profilePatch.ss_required = patch.ss_required;
  if (patch.majors !== undefined) profilePatch.majors = patch.majors;
  if (patch.minors !== undefined) profilePatch.minors = patch.minors;
  if (patch.teams !== undefined) profilePatch.teams = patch.teams;
  if (patch.email !== undefined) profilePatch.emails = patch.email ? [patch.email] : [];
  if (patch.mentee_uids !== undefined) profilePatch.mentee_count = patch.mentee_uids?.length ?? 0;

  if (Object.keys(profilePatch).length > 0 || patch.mentee_uids !== undefined) {
    const { data: profile, error: profileLookupError } = await supabase
      .from("profiles")
      .select("id")
      .eq("student_id", uid)
      .maybeSingle();
    if (profileLookupError) throw profileLookupError;
    if (profile) {
      if (Object.keys(profilePatch).length > 0) {
        const { error: profileUpdateError } = await supabase
          .from("profiles")
          .update(profilePatch)
          .eq("id", profile.id);
        if (profileUpdateError) throw profileUpdateError;
      }
      if (patch.mentee_uids !== undefined) {
        await replaceMentorMenteeAssignments(profile.id, patch.mentee_uids ?? []);
      }
    }
  }

  return mapped;
}

export type CreateScholarProfileInput = {
  userId: string;
  email: string;
  first_name: string;
  last_name: string;
  student_id: string;
  phone_number?: string | null;
  cohort: number;
};

/** Writable `public.profiles` columns on self-service scholar create (excludes `created_at`, `full_name`). */
export function buildScholarProfileInsertRow(
  input: CreateScholarProfileInput,
): ScholarProfileInsert {
  return {
    id: input.userId,
    first_name: input.first_name,
    last_name: input.last_name,
    student_id: input.student_id,
    phone_number: input.phone_number ?? null,
    cohort: input.cohort,
    program_role: "Scholar",
    app_role: null,
    emails: [input.email],
    status: null,
    fd_required: null,
    ss_required: null,
    mentee_count: 0,
    majors: [] as string[],
    minors: [] as string[],
    teams: [] as string[],
  };
}

export async function createScholarProfile(input: CreateScholarProfileInput) {
  const supabase = getSupabaseClient();
  const row = buildScholarProfileInsertRow(input);

  const { data, error } = await supabase
    .from("profiles")
    .insert(row)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}
