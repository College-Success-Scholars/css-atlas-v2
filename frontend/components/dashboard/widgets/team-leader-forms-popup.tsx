"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Clock, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FORM_TYPES,
  FormDetailFooter,
  FormTypeTabs,
  McfWeekPanel,
  WahfTabBody,
  WplTabBody,
  formFooterStatus,
  type FormTabStatus,
} from "@/components/personal/form-detail-views";
import {
  findSubmissionForCampusWeek,
  formatSubmittedDay,
  getFormStatusForWeek,
  type FormType,
} from "@/components/personal/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { backendPost } from "@/lib/client/api-client";
import { formatCampusWeekDateRange, semesterCampusWeeks } from "@/lib/format/campus-week";
import { getMcfWplDeadlineForWeek, getWhafDeadlineForWeek } from "@/lib/format/form-deadlines";
import { dateToCampusWeek } from "@/lib/format/time";
import type { McfRow, MenteeRow, WahfRow, WplRow } from "@/lib/types/supabase";
import { Avatar, teamBadgeClassName } from "./directory-person-badges";
import type { DirectoryPerson, DirectoryTeamLeader } from "./directory-state";
import { directoryTeamPresentationFor } from "./directory-team-presentation";
import {
  FORM_CELL_DOT_CLASSES,
  FORM_CELL_TONE_CLASSES,
  formCellFor,
  type FormCell,
} from "./team-leader-forms";

export type TeamLeaderSelection = { person: DirectoryPerson; teamLeader: DirectoryTeamLeader };

type TeamLeaderForms = { wahf: WahfRow[]; wpl: WplRow[]; mcf: McfRow[]; mentees: MenteeRow[] };

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; forms: TeamLeaderForms };

/** Each form's cell per campus week; weeks that haven't started have no cell. */
type FormCells = Map<FormType, Map<number, FormCell>>;

/**
 * Read-only WAHF, WPL and MCF history for one team leader: a Dialog on desktop,
 * a bottom Sheet on phones. Everything loads once on open; weeks, tabs and
 * mentees then switch in the browser.
 */
export function TeamLeaderFormsPopup({
  selection,
  onClose,
}: {
  selection: TeamLeaderSelection | null;
  onClose: () => void;
}) {
  const isMobile = useIsMobile();
  const open = selection !== null;
  const onOpenChange = (next: boolean) => {
    if (!next) onClose();
  };
  const content = selection && <TeamLeaderFormsContent key={selection.person.id} selection={selection} />;

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[calc(100dvh-3rem)] gap-0 rounded-t-2xl p-0 [&>button]:cursor-pointer">
          <div aria-hidden="true" className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,64rem)] w-[calc(100%-2rem)] max-w-5xl flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-5xl [&>button]:cursor-pointer">
        {content}
      </DialogContent>
    </Dialog>
  );
}

function useTeamLeaderForms(teamLeader: DirectoryTeamLeader) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const uids = [teamLeader.uid];
      const menteeUids = teamLeader.mentee_uids ?? [];
      const [wahf, wpl, mcf, names] = await Promise.all([
        backendPost<WahfRow[]>("/api/form-logs/whaf/by-uids", { uids }),
        backendPost<WplRow[]>("/api/form-logs/wpl/by-uids", { uids }),
        backendPost<McfRow[]>("/api/form-logs/mcf/by-uids", { uids, field: "mentor_uid" }),
        menteeUids.length ? backendPost<Record<string, string>>("/api/users/scholar-names", { uids: menteeUids }) : null,
      ]);
      if (cancelled) return;
      if (!wahf.ok || !wpl.ok || !mcf.ok) {
        setState({ status: "error" });
        return;
      }
      // A missing name only costs the label, so fall back to the UID rather than fail.
      const nameByUid = names?.ok ? names.data : {};
      const mentees: MenteeRow[] = menteeUids.map((menteeUid) => ({
        scholar_uid: menteeUid,
        first_name: nameByUid[menteeUid] ?? `UID ${menteeUid}`,
        last_name: null,
        fd_required: null,
        ss_required: null,
      }));
      setState({ status: "ready", forms: { wahf: wahf.data, wpl: wpl.data, mcf: mcf.data, mentees } });
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [teamLeader, attempt]);

  const retry = () => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  };

  return { state, retry };
}

function dueDay(deadline: Date | null): string | null {
  return deadline ? formatSubmittedDay(deadline.toISOString()) : null;
}

function TeamLeaderFormsContent({ selection }: { selection: TeamLeaderSelection }) {
  const { person, teamLeader } = selection;
  const { state, retry } = useTeamLeaderForms(teamLeader);
  const currentCampusWeek = useMemo(() => dateToCampusWeek(new Date()), []);

  return (
    <>
      <TeamLeaderHeader person={person} />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 sm:px-7 sm:pb-7">
        {currentCampusWeek == null ? (
          <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            The collection year hasn&apos;t started yet, so there are no forms to show.
          </p>
        ) : state.status === "error" ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <span>Couldn&apos;t load these forms.</span>
            <Button type="button" size="sm" variant="outline" className="cursor-pointer" onClick={retry}>
              Try again
            </Button>
          </div>
        ) : (
          <SemesterForms
            forms={state.status === "ready" ? state.forms : null}
            menteeCount={teamLeader.mentee_count ?? 0}
            currentCampusWeek={currentCampusWeek}
          />
        )}
      </div>
    </>
  );
}

function TeamLeaderHeader({ person }: { person: DirectoryPerson }) {
  const contact = [person.email, person.phoneNumber].filter(Boolean).join(" · ");
  const roleLine = [person.programRole ?? "No role assigned", person.cohort != null ? `Cohort ${person.cohort}` : null]
    .filter(Boolean)
    .join(" · ");

  // Dialog and Sheet share Radix's dialog primitive, so these titles label either one.
  return (
    <div className="flex shrink-0 items-start gap-3 px-4 pt-4 pr-12 pb-3 sm:gap-4 sm:px-7 sm:pt-6 sm:pr-14 sm:pb-5">
      <Avatar name={person.name} className="size-11 text-sm sm:size-13 sm:text-base" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <DialogTitle className="text-lg leading-tight font-semibold tracking-tight sm:text-2xl">
          {person.name}
          {person.uid && (
            <span className="ml-2 font-mono text-xs font-normal tracking-normal text-muted-foreground sm:text-sm">
              UID {person.uid}
            </span>
          )}
        </DialogTitle>
        <DialogDescription className="sr-only">
          WAHF, WPL and MCF for every week this semester. Read-only.
        </DialogDescription>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm text-muted-foreground">{roleLine}</span>
          {person.teams.map((team) => (
            <Badge key={team} variant="outline" className={teamBadgeClassName(team)}>
              {directoryTeamPresentationFor(team).label}
            </Badge>
          ))}
        </div>
        <p className="truncate text-xs text-muted-foreground sm:text-sm">{contact || "No contact listed"}</p>
      </div>
    </div>
  );
}

function SemesterForms({
  forms,
  menteeCount,
  currentCampusWeek,
}: {
  /** Null while the forms load. */
  forms: TeamLeaderForms | null;
  menteeCount: number;
  currentCampusWeek: number;
}) {
  const weeks = useMemo(() => semesterCampusWeeks(currentCampusWeek), [currentCampusWeek]);
  // Winter break sits past the last Fall week, so "this week" is that last week.
  const homeWeek = Math.min(currentCampusWeek, weeks.at(-1) ?? currentCampusWeek);
  const [week, setWeek] = useState(homeWeek);
  const [tab, setTab] = useState<FormType>("WAHF");
  const sectionId = useId();
  const panelId = `${sectionId}-panel`;

  const cells = useMemo(() => {
    const byForm: FormCells = new Map();
    if (!forms) return byForm;
    for (const formType of FORM_TYPES) {
      const byWeek = new Map<number, FormCell>();
      for (const w of weeks) {
        if (w > currentCampusWeek) continue;
        byWeek.set(
          w,
          formCellFor(getFormStatusForWeek(formType, forms.wahf, forms.mcf, forms.wpl, w, currentCampusWeek, menteeCount)),
        );
      }
      byForm.set(formType, byWeek);
    }
    return byForm;
  }, [forms, weeks, currentCampusWeek, menteeCount]);

  const pickCell = (pickedWeek: number, formType: FormType) => {
    setWeek(pickedWeek);
    setTab(formType);
  };

  return (
    <>
      <section aria-labelledby={`${sectionId}-semester`} className="rounded-xl border bg-card p-3 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-5 gap-y-2 sm:mb-4">
          <h3 id={`${sectionId}-semester`} className="text-sm font-semibold sm:text-base">
            Semester forms <span className="font-normal text-muted-foreground">· select a week</span>
          </h3>
          <SemesterLegend />
        </div>
        {forms ? (
          <SemesterGrid
            weeks={weeks}
            currentCampusWeek={currentCampusWeek}
            selectedWeek={week}
            cells={cells}
            onPick={pickCell}
          />
        ) : (
          <SemesterGridSkeleton />
        )}
        <p className="mt-2 text-xs text-muted-foreground sm:hidden">Swipe for more weeks</p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-5 pb-3">
        <div className="min-w-0">
          <h3 aria-live="polite" className="text-base font-semibold sm:text-lg">
            Week {week} · {formatCampusWeekDateRange(week)}
          </h3>
          {week === currentCampusWeek && (
            <p className="text-sm text-info">
              In progress · WAHF due {dueDay(getWhafDeadlineForWeek(week))}, WPL and MCF due{" "}
              {dueDay(getMcfWplDeadlineForWeek(week))}
            </p>
          )}
        </div>
        {week !== homeWeek && (
          <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => setWeek(homeWeek)}>
            Back to this week
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b p-3 sm:px-5 sm:py-4">
          <FormTypeTabs activeTab={tab} onTabChange={setTab} panelId={panelId} statuses={tabStatusesFor(cells, week)} />
        </div>
        <div role="tabpanel" id={panelId} aria-labelledby={`${panelId}-tab-${tab}`} className="p-4 sm:p-6">
          {forms ? (
            <FormPanelBody
              formType={tab}
              week={week}
              forms={forms}
              notYetDue={cells.get(tab)?.get(week)?.tone === "not-due"}
            />
          ) : (
            <FormPanelSkeleton />
          )}
        </div>
        {forms && (
          <FormDetailFooter
            formType={tab}
            status={formFooterStatus(tab, forms, week, currentCampusWeek, menteeCount)}
            readOnly
          />
        )}
      </div>
    </>
  );
}

function tabStatusesFor(cells: FormCells, week: number): Partial<Record<FormType, FormTabStatus>> {
  const statuses: Partial<Record<FormType, FormTabStatus>> = {};
  for (const formType of FORM_TYPES) {
    const cell = cells.get(formType)?.get(week);
    if (cell) statuses[formType] = { label: cell.label, dotClassName: FORM_CELL_DOT_CLASSES[cell.tone] };
  }
  return statuses;
}

function emptyFormLabel(formType: "WAHF" | "WPL", week: number, notYetDue: boolean): string {
  const deadline = formType === "WAHF" ? getWhafDeadlineForWeek(week) : getMcfWplDeadlineForWeek(week);
  const due = notYetDue ? dueDay(deadline) : null;
  return due ? `${formType} for week ${week} is due ${due}.` : `No ${formType} was submitted for week ${week}.`;
}

function FormPanelBody({
  formType,
  week,
  forms,
  notYetDue,
}: {
  formType: FormType;
  week: number;
  forms: TeamLeaderForms;
  notYetDue: boolean;
}) {
  if (formType === "WAHF") {
    return (
      <WahfTabBody
        variant="directory"
        row={findSubmissionForCampusWeek(forms.wahf, week)}
        emptyLabel={emptyFormLabel("WAHF", week, notYetDue)}
      />
    );
  }
  if (formType === "WPL") {
    return (
      <WplTabBody
        variant="directory"
        row={findSubmissionForCampusWeek(forms.wpl, week)}
        emptyLabel={emptyFormLabel("WPL", week, notYetDue)}
      />
    );
  }
  return (
    <McfWeekPanel
      key={week}
      campusWeek={week}
      mcf={forms.mcf}
      mentees={forms.mentees}
      picker="list"
      notYetDue={notYetDue}
    />
  );
}

function SemesterLegend() {
  const items = [
    { label: "On time", className: FORM_CELL_TONE_CLASSES["on-time"] },
    { label: "Late or partial", className: FORM_CELL_TONE_CLASSES.late },
    { label: "Missing", className: FORM_CELL_TONE_CLASSES.missing },
    { label: "Not yet due", className: FORM_CELL_TONE_CLASSES["not-due"] },
  ];
  return (
    <ul className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-muted-foreground">
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={`size-3 rounded-[4px] border ${item.className}`} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function SemesterGrid({
  weeks,
  currentCampusWeek,
  selectedWeek,
  cells,
  onPick,
}: {
  weeks: number[];
  currentCampusWeek: number;
  selectedWeek: number;
  cells: FormCells;
  onPick: (week: number, formType: FormType) => void;
}) {
  const selectedHeaderRef = useRef<HTMLSpanElement>(null);

  // Phones show a few weeks at a time; start with the selected week in view.
  useEffect(() => {
    selectedHeaderRef.current?.scrollIntoView?.({ block: "nearest", inline: "center" });
  }, []);

  return (
    <div className="-mx-3 overflow-x-auto px-3 pt-1 pb-2 sm:mx-0 sm:px-1">
      <div
        className="grid items-center gap-1.5"
        style={{
          gridTemplateColumns: `3.5rem repeat(${weeks.length}, minmax(2.5rem, 1fr))`,
          minWidth: `${3.5 + weeks.length * 2.875}rem`,
        }}
      >
        <span />
        {weeks.map((w) => {
          const isCurrent = w === currentCampusWeek;
          return (
            <span
              key={w}
              ref={w === selectedWeek ? selectedHeaderRef : undefined}
              className={`rounded-md py-1 text-center text-xs tabular-nums ${
                isCurrent
                  ? "bg-info-muted font-semibold text-info-muted-foreground"
                  : w === selectedWeek
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground"
              }`}
            >
              {isCurrent ? "Now" : w}
            </span>
          );
        })}
        {FORM_TYPES.map((formType) => (
          <Fragment key={formType}>
            <span className="sticky left-0 z-10 bg-card text-sm font-medium">{formType}</span>
            {weeks.map((w) => (
              <SemesterCell
                key={w}
                week={w}
                formType={formType}
                cell={cells.get(formType)?.get(w) ?? null}
                isCurrent={w === currentCampusWeek}
                isSelected={w === selectedWeek}
                onPick={onPick}
              />
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function SemesterCell({
  week,
  formType,
  cell,
  isCurrent,
  isSelected,
  onPick,
}: {
  week: number;
  formType: FormType;
  /** Null for weeks that haven't started; those can't be selected. */
  cell: FormCell | null;
  isCurrent: boolean;
  isSelected: boolean;
  onPick: (week: number, formType: FormType) => void;
}) {
  const base =
    "flex h-11 w-full items-center justify-center rounded-lg border text-xs font-semibold tabular-nums transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

  if (!cell) {
    return (
      <button
        type="button"
        disabled
        aria-label={`Week ${week} ${formType}: not started`}
        className={`${base} cursor-default border-dashed border-border/60 bg-transparent`}
      />
    );
  }

  const outline = isSelected
    ? "ring-2 ring-foreground ring-offset-2 ring-offset-card"
    : isCurrent
      ? "outline-1 outline-offset-2 outline-dashed outline-info"
      : "";

  return (
    <button
      type="button"
      aria-pressed={isSelected}
      aria-label={`Week ${week} ${formType}: ${[cell.label, cell.coverageLabel].filter(Boolean).join(", ")}`}
      onClick={() => onPick(week, formType)}
      className={`${base} cursor-pointer ${FORM_CELL_TONE_CLASSES[cell.tone]} ${outline}`}
    >
      {cell.coverage ?? <CellIcon tone={cell.tone} />}
    </button>
  );
}

function CellIcon({ tone }: { tone: FormCell["tone"] }) {
  if (tone === "on-time") return <Check className="size-4" aria-hidden="true" />;
  if (tone === "late") return <Clock className="size-4" aria-hidden="true" />;
  if (tone === "missing") return <X className="size-4" aria-hidden="true" />;
  return null;
}

function SemesterGridSkeleton() {
  return (
    <div className="space-y-1.5" aria-busy="true" aria-label="Loading forms">
      <Skeleton className="h-6 w-full" />
      {FORM_TYPES.map((formType) => (
        <Skeleton key={formType} className="h-11 w-full" />
      ))}
    </div>
  );
}

function FormPanelSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="hidden h-10 sm:block" />
      </div>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}
