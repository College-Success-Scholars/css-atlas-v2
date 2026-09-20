/**
 * @file auth.ts
 * @module shared
 *
 * Shared auth constants and pure helpers for role hierarchy and profile merging.
 * Single source of truth for both backend auth middleware and frontend server auth.
 */

export const APP_ROLE_ORDER = [null, "team_leader", "developer"] as const;
export type AppRole = (typeof APP_ROLE_ORDER)[number];

export type MinAppRole = "team_leader" | "developer";

export function hasRoleAtLeast(role: string | null, minRole: MinAppRole): boolean {
  const idx = APP_ROLE_ORDER.indexOf(role as AppRole);
  const minIdx = APP_ROLE_ORDER.indexOf(minRole);
  return idx >= 0 && idx >= minIdx;
}

const UMD_EMAIL_DOMAINS = ["umd.edu", "terpmail.umd.edu"] as const;

/**
 * Returns true when the email belongs to an allowed UMD domain.
 * Accepts @umd.edu and @terpmail.umd.edu (case-insensitive).
 */
export function isUmdEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at === normalized.length - 1) return false;
  const domain = normalized.slice(at + 1);
  return (UMD_EMAIL_DOMAINS as readonly string[]).includes(domain);
}

type RosterFields = {
  program_role?: string | null;
  cohort?: unknown;
  last_name?: string | null;
  first_name?: string | null;
  email?: string | null;
  app_role?: string | null;
};

export type ProfileWithRoster = RosterFields & {
  user_roster?: RosterFields | null;
};

/**
 * Fills missing profile fields from the joined user_roster row.
 * Should be removed once user_roster is fully migrated to profiles.
 */
export function mergeProfileWithRoster<T extends ProfileWithRoster>(profile: T): T {
  const roster = profile.user_roster;
  if (!roster) return profile;

  if (!profile.program_role) {
    profile.program_role = roster.program_role ?? null;
  }
  if (!profile.cohort) {
    profile.cohort = roster.cohort;
  }
  if (!profile.last_name) {
    profile.last_name = roster.last_name ?? null;
  }
  if (!profile.first_name) {
    profile.first_name = roster.first_name ?? null;
  }
  if (!profile.email) {
    profile.email = roster.email ?? null;
  }
  if (!profile.app_role) {
    profile.app_role = roster.app_role ?? null;
  }

  return profile;
}

export function isDeveloperProfile(profile: { app_role?: string | null } | null | undefined): boolean {
  return profile?.app_role === "developer";
}

/** Row shape from public.dev_test_profiles (subset used for overlay). */
export type DevTestProfileRow = {
  id: string;
  label: string;
  roster_uid: string;
  program_role?: string | null;
  app_role?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  cohort?: number | null;
  fd_required?: number | null;
  ss_required?: number | null;
  teams?: string[] | null;
  mentee_uids?: string[] | null;
  mentee_count?: number | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Maps roster_uid to profiles.student_id (Postgres `text`). */
function rosterUidToStudentId(rosterUid: string): string {
  return rosterUid.trim();
}

/**
 * Overlays a dev test profile onto the developer's real profile for effective identity.
 * Preserves the developer's auth id; student_id becomes roster_uid for data queries.
 *
 * Clears nested `user_roster` so persona gates (e.g. mentee nav) cannot read the
 * developer's real mentee_count / mentee_uids via roster fallbacks.
 */
export function mapTestProfileToEffectiveRow<T extends Record<string, unknown>>(
  realProfile: T,
  testProfile: DevTestProfileRow,
): T {
  const studentId = rosterUidToStudentId(testProfile.roster_uid);
  return {
    ...realProfile,
    program_role: testProfile.program_role ?? null,
    app_role: testProfile.app_role ?? null,
    first_name: testProfile.first_name ?? realProfile.first_name ?? null,
    last_name: testProfile.last_name ?? realProfile.last_name ?? null,
    cohort: testProfile.cohort ?? realProfile.cohort ?? null,
    fd_required: testProfile.fd_required ?? realProfile.fd_required ?? null,
    ss_required: testProfile.ss_required ?? realProfile.ss_required ?? null,
    teams: testProfile.teams ?? [],
    mentee_uids: testProfile.mentee_uids ?? [],
    mentee_count: testProfile.mentee_count ?? 0,
    student_id: studentId,
    // Drop the developer's joined roster — mentee/role fallbacks must use persona fields only.
    user_roster: null,
    _devTestProfileLabel: testProfile.label,
  } as T;
}

/** Effective scholar/roster uid from profile.student_id (string or number). */
export function getEffectiveScholarId(
  profile: { student_id?: unknown } | null | undefined,
): string | null {
  if (profile?.student_id == null) return null;
  if (typeof profile.student_id === "number" && Number.isFinite(profile.student_id)) {
    return String(profile.student_id);
  }
  if (typeof profile.student_id === "string" && profile.student_id.trim() !== "") {
    return profile.student_id.trim();
  }
  return null;
}

type ScholarAccessProfile = {
  app_role?: string | null;
  student_id?: unknown;
};

/**
 * True when the profile is team_leader+ or the requested roster uid is their own
 * `student_id`. Used by uid-scoped form-log (and similar) gates.
 */
export function canAccessRequestedScholarId(
  profile: ScholarAccessProfile | null | undefined,
  requestedId: string,
): boolean {
  if (hasRoleAtLeast(profile?.app_role ?? null, "team_leader")) return true;
  const self = getEffectiveScholarId(profile);
  if (!self) return false;
  return self === requestedId.trim();
}

/** Parse `scholarId` / legacy `studentId` from a JSON body. Empty or missing → null. */
export function parseRequestedScholarId(body: unknown): string | null {
  if (body == null || typeof body !== "object") return null;
  const b = body as { scholarId?: unknown; studentId?: unknown };
  if (typeof b.scholarId === "string" && b.scholarId.trim() !== "") {
    return b.scholarId.trim();
  }
  if (b.studentId == null || b.studentId === "") return null;
  const asString = String(b.studentId).trim();
  return asString === "" ? null : asString;
}

export const DEV_ACTIVE_PROFILE_HEADER = "x-dev-active-profile";
export const DEV_ACTIVE_PROFILE_COOKIE = "dev-active-profile";
