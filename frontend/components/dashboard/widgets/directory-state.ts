export type DirectoryView = "flat" | "grouped";
export type DirectorySort = "asc" | "desc";

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

/** The /api/users/directory query for the current filters, in the shape `callEndpoint` takes. */
export function directoryQuery(state: DirectoryState, cursor?: string | null, group?: string, limit?: number) {
  return {
    view: state.view,
    sort: state.sort,
    ...(state.search ? { search: state.search } : {}),
    ...(state.team ? { team: state.team } : {}),
    ...(state.programRole ? { programRole: state.programRole } : {}),
    ...(state.cohort ? { cohort: state.cohort } : {}),
    ...(cursor ? { cursor } : {}),
    ...(group ? { group } : {}),
    ...(limit ? { limit } : {}),
  };
}
