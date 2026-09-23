"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Filter, Search } from "lucide-react";
import { backendGet } from "@/lib/client/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { activeFilterCount, directoryPath, initialDirectoryState, type DirectoryFilters, type DirectoryState } from "./directory-state";

const PAGE_SIZE = 10;
const ALL_VALUE = "all";

type DirectoryPerson = {
  id: string;
  name: string;
  cohort: number | null;
  email: string | null;
  phoneNumber: string | null;
  teams: string[];
  programRole: string | null;
};

type Pagination = {
  total: number;
  range: { start: number; end: number };
  hasNext: boolean;
  nextCursor: string | null;
};

type DirectoryGroup = { team: string; members: DirectoryPerson[]; pagination: Pagination };
type DirectoryFlatResponse = { view: "flat"; members: DirectoryPerson[]; pagination: Pagination };
type DirectoryGroupedResponse = { view: "grouped"; total: number; groups: DirectoryGroup[] };
type DirectoryResponse = DirectoryFlatResponse | DirectoryGroupedResponse;

type DirectoryFacets = { teams: string[]; programRoles: string[]; cohorts: number[] };
const emptyFacets: DirectoryFacets = { teams: [], programRoles: [], cohorts: [] };

const LARGE_GROUP_THRESHOLD = 50;

/** Shared column template so the header row and every person row line up. */
const DIRECTORY_GRID_COLS = "grid-cols-[minmax(11rem,1.4fr)_4.5rem_minmax(13rem,1.2fr)_minmax(11rem,1fr)_1.5rem]";

/** Deterministic pastel palette so the same team or name always gets the same color. */
function paletteIndex(value: string, size: number): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash % size;
}

const TEAM_BADGE_STYLES = [
  "border-info/40 bg-info-muted text-info-muted-foreground",
  "border-success/40 bg-success-muted text-success-muted-foreground",
  "border-warning/40 bg-warning-muted text-warning-muted-foreground",
  "border-violet-400/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
];

function teamBadgeClassName(team: string): string {
  return TEAM_BADGE_STYLES[paletteIndex(team, TEAM_BADGE_STYLES.length)]!;
}

const AVATAR_STYLES = [
  "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-violet-500/15 text-violet-700 dark:text-violet-300",
];

function avatarClassName(name: string): string {
  return AVATAR_STYLES[paletteIndex(name, AVATAR_STYLES.length)]!;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase() || "?";
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarClassName(name)}`}
    >
      {initialsFor(name)}
    </span>
  );
}

function TeamAndRole({ person }: { person: DirectoryPerson }) {
  return (
    <div className="min-w-0">
      {person.teams.length ? (
        <div className="flex flex-wrap gap-1">
          {person.teams.map((team) => (
            <Badge key={team} variant="outline" className={teamBadgeClassName(team)}>{team}</Badge>
          ))}
        </div>
      ) : (
        <Badge variant="secondary">Unassigned</Badge>
      )}
      <p className="mt-1 truncate text-xs text-muted-foreground">{person.programRole ?? "No role assigned"}</p>
    </div>
  );
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function FacetSelect({
  label,
  placeholder,
  value,
  options,
  onChange,
  triggerClassName,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  triggerClassName: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      <span className="sr-only">{label}</span>
      <Select value={value || ALL_VALUE} onValueChange={(next) => onChange(next === ALL_VALUE ? "" : next)}>
        <SelectTrigger className={triggerClassName}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>{placeholder}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>{option}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

/**
 * "stacked" renders a full-width, one-per-row grid for the mobile filters sheet.
 * "inline" renders its own real flex row (fixed-width triggers, not w-full) so it can
 * sit alongside the view toggle and sort control in the desktop toolbar without a
 * grid fighting that flexbox for width.
 */
function DirectoryFiltersForm({
  filters,
  facets,
  onChange,
  layout = "stacked",
}: {
  filters: DirectoryFilters;
  facets: DirectoryFacets;
  onChange: (filters: DirectoryFilters) => void;
  layout?: "stacked" | "inline";
}) {
  const triggerClassName = layout === "inline" ? "h-11 w-44" : "h-11 w-full";
  const fields = (
    <>
      <FacetSelect
        label="Team"
        placeholder="All teams"
        value={filters.team}
        options={facets.teams}
        onChange={(team) => onChange({ ...filters, team })}
        triggerClassName={triggerClassName}
      />
      <FacetSelect
        label="Program role"
        placeholder="All program roles"
        value={filters.programRole}
        options={facets.programRoles}
        onChange={(programRole) => onChange({ ...filters, programRole })}
        triggerClassName={triggerClassName}
      />
      <FacetSelect
        label="Cohort"
        placeholder="All cohorts"
        value={filters.cohort}
        options={facets.cohorts.map(String)}
        onChange={(cohort) => onChange({ ...filters, cohort })}
        triggerClassName={triggerClassName}
      />
    </>
  );
  if (layout === "inline") {
    return <div className="hidden flex-wrap items-center gap-2 md:flex">{fields}</div>;
  }
  return <div className="grid gap-3 sm:grid-cols-3">{fields}</div>;
}

function DirectoryRow({ person, onOpen }: { person: DirectoryPerson; onOpen: (person: DirectoryPerson) => void }) {
  return (
    <button
      type="button"
      className={`group grid min-h-11 w-full items-center gap-4 border-b border-l-4 border-l-transparent px-3 py-3 text-left transition-colors hover:border-l-primary hover:bg-muted/60 focus-visible:border-l-primary focus-visible:bg-muted/60 focus-visible:outline-none ${DIRECTORY_GRID_COLS}`}
      onClick={() => onOpen(person)}
    >
      <span className="flex min-w-0 items-center gap-3">
        <Avatar name={person.name} />
        <span className="truncate font-medium">{person.name}</span>
      </span>
      <span className="text-sm text-muted-foreground">{person.cohort ?? "—"}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm text-muted-foreground">{person.email ?? "No contact listed"}</span>
        {person.phoneNumber && <span className="block truncate text-xs text-muted-foreground">{person.phoneNumber}</span>}
      </span>
      <TeamAndRole person={person} />
      <ChevronRight className="size-4 shrink-0 justify-self-end text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
    </button>
  );
}

function Pager({
  pagination,
  currentPage,
  onPrevious,
  onNext,
}: {
  pagination: Pagination;
  currentPage: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const totalPages = Math.max(1, Math.ceil(pagination.total / PAGE_SIZE));
  return (
    <div className="flex flex-col gap-2 border-t pt-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>{pagination.range.start}-{pagination.range.end} of {pagination.total}</span>
      <div className="flex items-center gap-3">
        <span>Page {currentPage} of {totalPages}</span>
        <div className="flex gap-2">
          <Button className="min-h-11 min-w-11" variant="outline" size="icon" disabled={currentPage <= 1} onClick={onPrevious} aria-label="Previous page">
            <ChevronRight className="rotate-180" />
          </Button>
          <Button className="min-h-11 min-w-11" variant="outline" size="icon" disabled={!pagination.nextCursor} onClick={onNext} aria-label="Next page">
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Advances or rewinds a cursor-paginated view's history stack. */
function useCursorPagination() {
  const [cursors, setCursors] = useState<string[]>([]);
  const currentCursor = cursors.at(-1) ?? null;
  const currentPage = cursors.length + 1;

  const goNext = (nextCursor: string | null) => {
    if (!nextCursor) return null;
    setCursors((prev) => [...prev, nextCursor]);
    return nextCursor;
  };
  const goPrevious = () => {
    if (cursors.length === 0) return null;
    const next = cursors.slice(0, -1);
    setCursors(next);
    return next.at(-1) ?? null;
  };
  const reset = () => setCursors([]);

  return { currentCursor, currentPage, goNext, goPrevious, reset };
}

/** Cursor history per expanded team group, keyed by team name. Plain state (not per-group hooks) since the set of teams is dynamic. */
function useGroupCursorPagination() {
  const [byTeam, setByTeam] = useState<Record<string, string[]>>({});

  const currentCursor = (team: string) => byTeam[team]?.at(-1) ?? null;
  const currentPage = (team: string) => (byTeam[team]?.length ?? 0) + 1;
  const goNext = (team: string, nextCursor: string | null) => {
    if (!nextCursor) return null;
    setByTeam((prev) => ({ ...prev, [team]: [...(prev[team] ?? []), nextCursor] }));
    return nextCursor;
  };
  const goPrevious = (team: string) => {
    const cursors = byTeam[team] ?? [];
    if (cursors.length === 0) return null;
    const next = cursors.slice(0, -1);
    setByTeam((prev) => ({ ...prev, [team]: next }));
    return next.at(-1) ?? null;
  };
  const reset = () => setByTeam({});

  return { currentCursor, currentPage, goNext, goPrevious, reset };
}

export function DirectoryDashboard() {
  const [state, setState] = useState<DirectoryState>(initialDirectoryState);
  const [searchInput, setSearchInput] = useState(initialDirectoryState.search);
  const debouncedSearch = useDebouncedValue(searchInput, 200);
  const [facets, setFacets] = useState<DirectoryFacets>(emptyFacets);
  const [response, setResponse] = useState<DirectoryResponse | null>(null);
  const flatPage = useCursorPagination();
  const groupPages = useGroupCursorPagination();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<DirectoryPerson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filters = { team: state.team, programRole: state.programRole, cohort: state.cohort };
  const effectiveState = { ...state, search: debouncedSearch };

  useEffect(() => {
    backendGet<DirectoryFacets>("/api/users/directory/facets").then((result) => {
      if (result.ok) setFacets(result.data);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      const result = await backendGet<DirectoryResponse>(directoryPath(effectiveState, flatPage.currentCursor, undefined, PAGE_SIZE));
      if (cancelled) return;
      if (result.ok) {
        setResponse(result.data);
        setError(null);
      } else setError(result.error);
      setLoading(false);
    };
    void run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.view, state.sort, state.team, state.programRole, state.cohort, debouncedSearch, flatPage.currentCursor]);

  const updateState = (next: DirectoryState) => {
    flatPage.reset();
    groupPages.reset();
    setExpandedGroup(null);
    setState(next);
  };

  const handleSearchChange = (value: string) => {
    flatPage.reset();
    groupPages.reset();
    setExpandedGroup(null);
    setSearchInput(value);
  };

  const loadGroupPage = async (team: string, cursor: string | null) => {
    setLoading(true);
    const result = await backendGet<DirectoryResponse>(directoryPath(effectiveState, cursor, team, PAGE_SIZE));
    if (result.ok && result.data.view === "grouped") {
      const nextGroup = result.data.groups[0];
      setResponse((current) =>
        current && current.view === "grouped"
          ? { ...current, groups: current.groups.map((group) => (group.team === team && nextGroup ? nextGroup : group)) }
          : current,
      );
      setError(null);
    } else if (!result.ok) setError(result.error);
    setLoading(false);
  };

  const pagination = response?.view === "flat" ? response.pagination : null;
  const filterCount = activeFilterCount(filters);
  const toggleGroup = (team: string) => setExpandedGroup((current) => (current === team ? null : team));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Directory</h1>
        <p className="text-muted-foreground">Search current members and alumni by name, team, role, or cohort.</p>
      </div>

      <label className="relative block">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="min-h-11 pl-10"
          value={searchInput}
          placeholder="Search by name, email, or UID"
          aria-label="Search by name, email, or UID"
          onChange={(event) => handleSearchChange(event.target.value)}
        />
      </label>

      <div className="flex flex-col gap-3">
        {/* Row 1: filter controls (left) and sort (right) — visible together at every width. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button className="min-h-11 md:hidden" variant="outline">
                  <Filter /> Filters{filterCount ? ` (${filterCount})` : ""}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                  <SheetDescription>Filter the directory by team, role, or cohort.</SheetDescription>
                </SheetHeader>
                <div className="p-4">
                  <DirectoryFiltersForm filters={filters} facets={facets} onChange={(next) => updateState({ ...state, ...next })} />
                </div>
              </SheetContent>
            </Sheet>
            <DirectoryFiltersForm filters={filters} facets={facets} onChange={(next) => updateState({ ...state, ...next })} layout="inline" />
            <div className="hidden overflow-hidden rounded-md border md:inline-flex">
              <Button
                className="min-h-11 rounded-none"
                size="sm"
                variant={state.view === "flat" ? "default" : "ghost"}
                onClick={() => updateState({ ...state, view: "flat" })}
              >
                Flat list
              </Button>
              <Button
                className="min-h-11 rounded-none border-l"
                size="sm"
                variant={state.view === "grouped" ? "default" : "ghost"}
                onClick={() => updateState({ ...state, view: "grouped" })}
              >
                By team
              </Button>
            </div>
          </div>

          <Select value={state.sort} onValueChange={(sort) => updateState({ ...state, sort: sort as DirectoryState["sort"] })}>
            <SelectTrigger className="h-11 w-auto">
              <span className="text-muted-foreground">Sort:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Name A–Z</SelectItem>
              <SelectItem value="desc">Name Z–A</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Row 2: view toggle — segmented buttons on desktop (row 1 above), a full-width dropdown on mobile. */}
        <Select
          value={state.view}
          onValueChange={(view) => updateState({ ...state, view: view as DirectoryState["view"] })}
        >
          <SelectTrigger className="h-11 w-full md:hidden">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="flat">Flat list</SelectItem>
            <SelectItem value="grouped">By team</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && <p className="rounded-md border border-destructive/50 p-3 text-sm text-destructive">{error}</p>}
      {loading && !response ? <p className="py-8 text-sm text-muted-foreground">Loading directory...</p> : null}

      {response?.view === "flat" && pagination && (
        <section aria-label="Directory results">
          <div className="overflow-x-auto">
            <div className="min-w-[46rem]">
              <div className={`grid items-center gap-4 border-b px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground ${DIRECTORY_GRID_COLS}`}>
                <span>Name</span><span>Cohort</span><span>Contact</span><span>Team &amp; role</span><span />
              </div>
              {response.members.map((person) => <DirectoryRow key={person.id} person={person} onOpen={setSelectedPerson} />)}
              {!response.members.length && <p className="py-8 text-center text-muted-foreground">No matching people.</p>}
            </div>
          </div>
          <Pager
            pagination={pagination}
            currentPage={flatPage.currentPage}
            onPrevious={() => flatPage.goPrevious()}
            onNext={() => flatPage.goNext(pagination.nextCursor)}
          />
        </section>
      )}

      {response?.view === "grouped" && (
        <section className="space-y-3" aria-label="Directory results by team">
          {response.groups.map((group) => {
            const isExpanded = expandedGroup === group.team;
            const isLarge = group.pagination.total > LARGE_GROUP_THRESHOLD;
            return (
              <div className="rounded-md border" key={group.team}>
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-3 text-left font-medium transition-colors hover:bg-muted/60"
                  onClick={() => toggleGroup(group.team)}
                  aria-expanded={isExpanded}
                >
                  <span>{group.team}</span>
                  <span className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                    {group.pagination.total} {group.pagination.total === 1 ? "person" : "people"}
                    <ChevronRight className={`size-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                  </span>
                </button>
                {!isExpanded && isLarge && (
                  <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                    Large group — search or filter narrows this before it opens.
                  </p>
                )}
                {isExpanded && (
                  <div className="border-t">
                    <div className="overflow-x-auto">
                      <div className="min-w-[46rem]">
                        {group.members.map((person) => <DirectoryRow key={person.id} person={person} onOpen={setSelectedPerson} />)}
                        {!group.members.length && <p className="py-6 text-center text-muted-foreground">No matching people.</p>}
                      </div>
                    </div>
                    <div className="px-3 pb-3">
                      <Pager
                        pagination={group.pagination}
                        currentPage={groupPages.currentPage(group.team)}
                        onPrevious={() => void loadGroupPage(group.team, groupPages.goPrevious(group.team))}
                        onNext={() => void loadGroupPage(group.team, groupPages.goNext(group.team, group.pagination.nextCursor))}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {!response.groups.length && <p className="py-8 text-center text-muted-foreground">No matching teams.</p>}
        </section>
      )}

      <Dialog open={selectedPerson !== null} onOpenChange={(open) => { if (!open) setSelectedPerson(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedPerson?.name}</DialogTitle>
            <DialogDescription>Profile details are coming soon. This directory currently supports discovery only.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
