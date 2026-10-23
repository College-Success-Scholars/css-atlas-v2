/** Week-scoped tutoring forms. All grouping and course cleanup here is display-only. */
"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Search, Users } from "lucide-react";
import { YearNotStartedState } from "@/components/dashboard/widgets/year-not-started-state";
import { CampusWeekUrlNav } from "@/components/data-display/campus-week-nav";
import { campusWeekNumbers, formatCampusWeekDateRange } from "@/lib/format/campus-week";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteTutorReportAction } from "@/lib/server/actions";
import type { TutorReportWeekRow } from "@/lib/types/tutor-report-log";
import { TutoringSessionDialog } from "./tutoring-session-dialog";
import {
  compareSessions, formatTutorMinutes, getSessionDay, normalizeCourses, normalizedTutor,
  scholarLabel, scholarStatus, sessionBlockKey, sessionDurationMinutes,
  tutoringSessionTimeLabel,
} from "./tutoring-display";

export type TeamsTutoringClientProps = {
  basePath: string;
  weekNum: number;
  currentCampusWeek: number | null;
  rows: TutorReportWeekRow[] | null;
  error: string | null;
};

type GroupBy = "day" | "tutor" | "scholar";
type Status = "all" | "with" | "without";
type SessionGroup = { key: string; forms: TutorReportWeekRow[] };
type Section = { key: string; title: string; forms: TutorReportWeekRow[]; groups: SessionGroup[] };

function buildSections(rows: TutorReportWeekRow[], groupBy: GroupBy): Section[] {
  const sections = new Map<string, Section>();
  for (const row of [...rows].sort(compareSessions)) {
    const day = getSessionDay(row);
    const status = scholarStatus(row);
    const key = groupBy === "day" ? day.key : groupBy === "tutor" ? normalizedTutor(row) :
      status === "none" ? "no-scholar" : `scholar:${row.scholar_uid?.trim()}`;
    const title = groupBy === "day" ? day.label : groupBy === "tutor" ? row.tutor_name.trim().replace(/\s+/g, " ") :
      status === "none" ? "No scholar" : scholarLabel(row);
    if (!sections.has(key)) sections.set(key, { key, title, forms: [], groups: [] });
    sections.get(key)!.forms.push(row);
  }
  const result = [...sections.values()];
  if (groupBy !== "day") result.sort((a, b) => a.title.localeCompare(b.title));
  for (const section of result) {
    const blocks = new Map<string, SessionGroup>();
    for (const row of section.forms) {
      const key = sessionBlockKey(row);
      if (!blocks.has(key)) blocks.set(key, { key, forms: [] });
      blocks.get(key)!.forms.push(row);
    }
    section.groups = [...blocks.values()];
  }
  return result;
}

function summary(forms: TutorReportWeekRow[]) {
  const blocks = new Map(forms.map((row) => [sessionBlockKey(row), row]));
  let unknownDuration = false;
  const minutes = [...blocks.values()].reduce((total, row) => {
    const duration = sessionDurationMinutes(row);
    if (duration == null) unknownDuration = true;
    return total + (duration ?? 0);
  }, 0);
  const empty = forms.filter((row) => scholarStatus(row) === "none").length;
  return `${forms.length} ${forms.length === 1 ? "form" : "forms"} · ${formatTutorMinutes(minutes)}${unknownDuration ? " (known time)" : ""} · ${empty} ${empty === 1 ? "empty session" : "empty sessions"}`;
}

function ScholarCell({ forms }: { forms: TutorReportWeekRow[] }) {
  if (forms.length === 1) {
    const row = forms[0];
    return scholarStatus(row) === "unmatched" ? (
      <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
        <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />Unmatched ID
      </span>
    ) : <span>{scholarLabel(row)}</span>;
  }
  const scholars = new Set(forms.filter((row) => scholarStatus(row) !== "none").map((row) => row.scholar_uid?.trim()));
  const names = [...new Set(forms.map(scholarLabel))].join(", ");
  return (
    <span className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 font-medium"><Users className="size-3.5" aria-hidden="true" />
        {scholars.size ? `Group · ${scholars.size} ${scholars.size === 1 ? "scholar" : "scholars"}` : `— · ${forms.length} forms`}
      </span>
      <span className="text-xs font-normal text-muted-foreground">{names}</span>
    </span>
  );
}

const selectClassName = "h-9 min-w-0 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

export function TeamsTutoringClient({ basePath, weekNum, currentCampusWeek, rows, error }: TeamsTutoringClientProps) {
  const router = useRouter();
  const yearStarted = currentCampusWeek != null;
  const weeks = useMemo(() => campusWeekNumbers(currentCampusWeek), [currentCampusWeek]);
  const [removedIds, setRemovedIds] = useState<Set<number>>(() => new Set());
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [tutor, setTutor] = useState("");
  const [course, setCourse] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [groupBy, setGroupBy] = useState<GroupBy>("day");
  const [busy, setBusy] = useState(false);
  const rowButtons = useRef(new Map<number, HTMLButtonElement>());
  const panelContainer = useRef<HTMLDivElement>(null);
  const listHeading = useRef<HTMLHeadingElement>(null);
  const focusAfterDelete = useRef<number | "heading" | null>(null);

  const activeRows = useMemo(() => (rows ?? []).filter((row) => !removedIds.has(row.id)), [rows, removedIds]);
  const tutors = useMemo(() => {
    const names = new Map<string, string>();
    for (const row of activeRows) {
      const key = normalizedTutor(row);
      if (!names.has(key)) names.set(key, row.tutor_name.trim().replace(/\s+/g, " "));
    }
    return [...names.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [activeRows]);
  const courses = useMemo(() => normalizeCourses(activeRows.flatMap((row) => row.courses)).sort(), [activeRows]);
  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase().replace(/\s+/g, " ");
    return activeRows.filter((row) => {
      const codes = normalizeCourses(row.courses);
      const text = [row.tutor_name, scholarLabel(row), ...codes, ...row.courses].join(" ").toLocaleLowerCase().replace(/\s+/g, " ");
      const matchesSearch = !query || text.includes(query) || codes.some((code) => code.toLocaleLowerCase().includes(query.replace(/\s/g, "")));
      return matchesSearch && (!tutor || normalizedTutor(row) === tutor) &&
        (!course || codes.includes(course)) && (status === "all" || (status === "without") === (scholarStatus(row) === "none"));
    });
  }, [activeRows, search, tutor, course, status]);
  const sections = useMemo(() => buildSections(filteredRows, groupBy), [filteredRows, groupBy]);
  const orderedForms = sections.flatMap((section) => section.groups.flatMap((group) => group.forms));
  const selectedIndex = orderedForms.findIndex((row) => row.id === selectedId);
  const selectedRow = orderedForms[selectedIndex];
  const selectedBlockCount = selectedRow ? activeRows.filter((row) => sessionBlockKey(row) === sessionBlockKey(selectedRow)).length : 0;
  const filtersActive = Boolean(search || tutor || course || status !== "all");

  useEffect(() => {
    if (selectedId == null) return;
    const desktop = window.matchMedia ? window.matchMedia("(min-width: 64rem)").matches : window.innerWidth >= 1024;
    if (desktop) return;
    panelContainer.current?.querySelector<HTMLElement>("h2")?.focus();
    panelContainer.current?.scrollIntoView?.({ block: "nearest" });
  }, [selectedId]);

  useEffect(() => {
    if (busy) return;
    const target = focusAfterDelete.current;
    if (target == null) return;
    (target === "heading" ? listHeading.current : rowButtons.current.get(target))?.focus();
    focusAfterDelete.current = null;
  }, [removedIds, busy]);

  function selectForm(id: number, focus = false) {
    if (busy) return;
    setSelectedId(id);
    const button = rowButtons.current.get(id);
    if (focus) button?.focus();
    button?.closest("tr")?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }

  function closeDetails() {
    if (busy) return;
    setSelectedId(null);
    if (selectedId != null) rowButtons.current.get(selectedId)?.focus();
  }

  return (
    <div className="space-y-6" onKeyDown={(event) => {
      if (event.key === "Escape" && selectedRow && !busy) { event.preventDefault(); closeDetails(); }
    }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tutoring</h1>
          <p className="mt-1 text-sm text-muted-foreground">{yearStarted ? `Week ${weekNum} · ${formatCampusWeekDateRange(weekNum)}` : "Tutor report forms"}</p>
        </div>
        {yearStarted && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" disabled={busy || weekNum === currentCampusWeek} onClick={() => router.push(`${basePath}?week=${currentCampusWeek}`)}>This week</Button>
            <fieldset disabled={busy} aria-label="Select campus week">
              <CampusWeekUrlNav selectedWeek={weekNum} weeks={weeks} currentCampusWeek={currentCampusWeek} basePath={basePath} />
            </fieldset>
          </div>
        )}
      </div>

      {!yearStarted ? <YearNotStartedState /> : <>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        {rows && <>
          <fieldset disabled={busy} className="space-y-3" aria-label="Filter tutoring forms">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex min-w-48 flex-1 flex-col gap-1.5 text-sm font-medium">
                <span>Search</span>
                <span className="relative block"><Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input value={search} onChange={(event) => { setSearch(event.target.value); setSelectedId(null); }} placeholder="Tutor, scholar, or course" className="h-9 pl-9 text-base font-normal md:text-base" />
                </span>
              </label>
              <label className="flex min-w-36 flex-col gap-1.5 text-sm font-medium">Tutor
                <select className={selectClassName} value={tutor} onChange={(event) => { setTutor(event.target.value); setSelectedId(null); }}>
                  <option value="">All tutors</option>{tutors.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
                </select>
              </label>
              <label className="flex min-w-32 flex-col gap-1.5 text-sm font-medium">Course
                <select className={selectClassName} value={course} onChange={(event) => { setCourse(event.target.value); setSelectedId(null); }}>
                  <option value="">All courses</option>{courses.map((code) => <option key={code} value={code}>{code}</option>)}
                </select>
              </label>
              <label className="flex min-w-28 flex-col gap-1.5 text-sm font-medium">Group by
                <select className={selectClassName} value={groupBy} onChange={(event) => setGroupBy(event.target.value as GroupBy)}>
                  <option value="day">Day</option><option value="tutor">Tutor</option><option value="scholar">Scholar</option>
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex gap-1 rounded-lg border bg-muted/40 p-1" role="group" aria-label="Scholar status">
                {([['all', 'All'], ['with', 'With scholar'], ['without', 'No scholar']] as const).map(([value, label]) => (
                  <Button key={value} size="sm" variant={status === value ? "secondary" : "ghost"} className={status === value ? "bg-background shadow-sm" : ""} aria-pressed={status === value} onClick={() => { setStatus(value); setSelectedId(null); }}>{label}</Button>
                ))}
              </div>
              {filtersActive && <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setTutor(""); setCourse(""); setStatus("all"); setSelectedId(null); }}>Clear filters</Button>}
            </div>
          </fieldset>

          <div className={`grid items-start gap-4 ${selectedRow ? "lg:grid-cols-[minmax(0,1fr)_24rem]" : "grid-cols-1"}`}>
            <Card className="min-w-0 gap-0 overflow-hidden py-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                <h2 ref={listHeading} tabIndex={-1} className="text-base font-semibold">Tutoring sessions</h2>
                <p className="text-xs text-muted-foreground" aria-live="polite">{filtersActive ? "Filtered · " : ""}{summary(filteredRows)}</p>
              </div>
              {filteredRows.length === 0 ? <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                <p>{activeRows.length === 0 ? "No tutoring sessions this week." : "No forms match your filters."}</p>
              </div> : <Table>
                <TableHeader><TableRow>
                  <TableHead className="pl-4">Tutor</TableHead>{groupBy !== "day" && <TableHead>Day</TableHead>}
                  <TableHead>Time</TableHead><TableHead>Scholar</TableHead><TableHead className="pr-4">Courses</TableHead>
                </TableRow></TableHeader>
                <TableBody>{sections.map((section) => <Fragment key={section.key}>
                  <TableRow className="bg-muted/40 hover:bg-muted/40"><TableCell colSpan={groupBy === "day" ? 4 : 5} className="px-4 py-3 whitespace-normal">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><h3 className="font-semibold">{section.title}</h3><span className="text-xs text-muted-foreground">{summary(section.forms)}</span></div>
                  </TableCell></TableRow>
                  {section.groups.map((group) => {
                    const first = group.forms[0];
                    const selected = group.forms.some((row) => row.id === selectedId);
                    const codes = normalizeCourses(group.forms.flatMap((row) => row.courses));
                    return <TableRow key={group.key} data-state={selected ? "selected" : undefined} className={`cursor-pointer ${selected ? "bg-primary/5 ring-1 ring-inset ring-primary/20" : ""}`} onClick={() => selectForm(first.id)}>
                      <TableCell className="pl-4 font-medium">{first.tutor_name}</TableCell>
                      {groupBy !== "day" && <TableCell>{getSessionDay(first).label}</TableCell>}
                      <TableCell><div className="font-medium tabular-nums">{tutoringSessionTimeLabel(first)}</div><div className="mt-1 text-xs text-muted-foreground">{sessionDurationMinutes(first) == null ? "Duration unavailable" : formatTutorMinutes(sessionDurationMinutes(first)!)}</div></TableCell>
                      <TableCell className="max-w-64 whitespace-normal">
                        <button type="button" disabled={busy} className="rounded-sm text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" aria-label={`Open session: ${group.forms.map(scholarLabel).join(", ")} with ${first.tutor_name}, ${getSessionDay(first).label}`} aria-expanded={selected} aria-controls={selected ? "tutoring-details" : undefined}
                          ref={(node) => { for (const row of group.forms) { if (node) rowButtons.current.set(row.id, node); else rowButtons.current.delete(row.id); } }}
                          onClick={(event) => { event.stopPropagation(); selectForm(first.id); }}
                          onKeyDown={(event) => {
                            if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                            event.preventDefault();
                            const index = selected ? selectedIndex : orderedForms.findIndex((row) => row.id === first.id);
                            const next = orderedForms[index + (event.key === "ArrowDown" ? 1 : -1)];
                            if (next) selectForm(next.id, true);
                          }}><ScholarCell forms={group.forms} /></button>
                      </TableCell>
                      <TableCell className="max-w-56 pr-4 whitespace-normal"><div className="flex flex-wrap gap-1">{codes.length ? codes.map((code) => <Badge key={code} variant="secondary" className="font-normal">{code}</Badge>) : <span className="text-muted-foreground">—</span>}</div></TableCell>
                    </TableRow>;
                  })}
                </Fragment>)}</TableBody>
              </Table>}
            </Card>
            {selectedRow && <div ref={panelContainer} className="order-first min-w-0 lg:sticky lg:top-4 lg:order-last">
              <TutoringSessionDialog key={selectedRow.id} open onOpenChange={(open) => { if (!open) closeDetails(); }} row={selectedRow} weekNum={weekNum} position={selectedIndex + 1} total={orderedForms.length} formsInBlock={selectedBlockCount} onBusyChange={setBusy}
                onPrevious={() => { const previous = orderedForms[selectedIndex - 1]; if (previous) selectForm(previous.id, true); }}
                onNext={() => { const next = orderedForms[selectedIndex + 1]; if (next) selectForm(next.id, true); }}
                onDelete={async () => {
                  const id = selectedRow.id;
                  const result = await deleteTutorReportAction(id);
                  if ("error" in result && result.error) throw new Error(result.error);
                  focusAfterDelete.current = orderedForms[selectedIndex + 1]?.id ?? orderedForms[selectedIndex - 1]?.id ?? "heading";
                  setSelectedId(null);
                  setRemovedIds((previous) => new Set(previous).add(id));
                  router.refresh();
                }} />
            </div>}
          </div>
        </>}
      </>}
    </div>
  );
}
