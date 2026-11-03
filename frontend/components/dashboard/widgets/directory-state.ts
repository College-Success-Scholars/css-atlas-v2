export type DirectoryView = "flat" | "grouped";
export type DirectorySort = "asc" | "desc";

export type DirectoryPerson = {
  id: string;
  name: string;
  uid: string | null;
  cohort: number | null;
  email: string | null;
  phoneNumber: string | null;
  teams: string[];
  programRole: string | null;
  /** Team-leader viewers see this; RLS returns false for everyone else. */
  isMentee: boolean;
};

export type DirectoryFilters = {
  team: string;
  programRole: string;
  cohort: string;
};

export type DirectoryState = DirectoryFilters & {
  view: DirectoryView;
  search: string;
  sort: DirectorySort;
};

export const initialDirectoryState: DirectoryState = {
  view: "flat",
  search: "",
  sort: "asc",
  team: "",
  programRole: "",
  cohort: "",
};

export function activeFilterCount(filters: DirectoryFilters) {
  return Object.values(filters).filter(Boolean).length;
}

/** Detail-page path for a mentee; null keeps the directory's profile modal. */
export function directoryMenteePath(
  uid: string | null,
  isMentee: boolean,
  cohort?: number | null,
): string | null {
  if (!uid || !isMentee) return null;
  const path = `/dashboard/directory/${encodeURIComponent(uid)}`;
  return cohort != null && Number.isFinite(cohort) ? `${path}?cohort=${cohort}` : path;
}

/** A row from GET /api/users/team-leaders, trimmed to what the Directory reads. */
export type DirectoryTeamLeader = {
  uid: string;
  mentee_count: number | null;
  mentee_uids: string[] | null;
};

/** Indexes team leaders by UID; Directory rows carry no team leader flag of their own. */
export function teamLeadersByUid(rows: DirectoryTeamLeader[]): Map<string, DirectoryTeamLeader> {
  return new Map(rows.map((row) => [row.uid, row]));
}

/** The team leader behind a Directory row; null keeps the row's existing open behavior. */
export function directoryTeamLeaderFor(
  uid: string | null,
  teamLeaders: ReadonlyMap<string, DirectoryTeamLeader>,
): DirectoryTeamLeader | null {
  return uid ? teamLeaders.get(uid) ?? null : null;
}

export function directoryPath(state: DirectoryState, cursor?: string | null, group?: string, limit?: number) {
  const params = new URLSearchParams({ view: state.view, sort: state.sort });
  if (state.search) params.set("search", state.search);
  if (state.team) params.set("team", state.team);
  if (state.programRole) params.set("programRole", state.programRole);
  if (state.cohort) params.set("cohort", state.cohort);
  if (cursor) params.set("cursor", cursor);
  if (group) params.set("group", group);
  if (limit) params.set("limit", String(limit));
  return `/api/users/directory?${params.toString()}`;
}
