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
