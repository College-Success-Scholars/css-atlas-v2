"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { backendPut } from "@/lib/client/api-client";
import { cn } from "@/lib/utils";
import { getEasternDayOfWeek, parseEasternDate } from "@/lib/format/time";
import { DailyBoard } from "./daily-board";
import {
  filterScholarsForKind,
  formatDateHeading,
  kindLabel,
  weekdayDatesForCampusWeek,
} from "./schedule-helpers";
import { ScholarReviewModal } from "./scholar-review-modal";
import { ScholarShiftsModal } from "./scholar-shifts-modal";
import {
  ShiftEditDialog,
  draftFromBlock,
  type ShiftEditDraft,
} from "./shift-edit-dialog";
import type {
  BoardScholar,
  ScheduleBoardActions,
  ScheduleViewMode,
  SessionKind,
  StandingShift,
} from "./types";
import { useDayShifts } from "./use-day-shifts";
import { WeeklyBoard } from "./weekly-board";

type ReplaceScholarShiftsResponse = {
  uid: string;
  shifts: StandingShift[];
};

function shiftWritePayload(shifts: StandingShift[]) {
  return shifts.map((shift) => ({
    kind: shift.kind,
    dayOfWeek: shift.dayOfWeek,
    startTime: shift.startTime,
    endTime: shift.endTime,
  }));
}

function withServerShifts(
  scholar: BoardScholar,
  shifts: StandingShift[],
): BoardScholar {
  return {
    ...scholar,
    shifts: shifts.map((shift) => ({ ...shift })),
  };
}

function replaceScholarInList(
  rows: BoardScholar[],
  next: BoardScholar,
): BoardScholar[] {
  return rows.map((row) => (row.uid === next.uid ? next : row));
}

function replaceScholarInBaseline(
  baselineJson: string,
  next: BoardScholar,
): string {
  const rows = JSON.parse(baselineJson) as BoardScholar[];
  return JSON.stringify(replaceScholarInList(rows, next));
}

type ScheduleViewsClientProps = {
  weekNum: number;
  scholars: BoardScholar[];
};

function cloneScholars(rows: BoardScholar[]): BoardScholar[] {
  return rows.map((s) => ({ ...s, shifts: s.shifts.map((shift) => ({ ...shift })) }));
}

function cloneScholar(row: BoardScholar): BoardScholar {
  return { ...row, shifts: row.shifts.map((shift) => ({ ...shift })) };
}

function withUpsertedShift(
  scholar: BoardScholar,
  shift: StandingShift,
  replaceId?: string,
): BoardScholar {
  const without = replaceId
    ? scholar.shifts.filter((s) => s.id !== replaceId)
    : scholar.shifts;
  return { ...scholar, shifts: [...without, shift] };
}

function withRemovedShift(scholar: BoardScholar, shiftId: string): BoardScholar {
  return {
    ...scholar,
    shifts: scholar.shifts.filter((s) => s.id !== shiftId),
  };
}

/** Pick a YYYY-MM-DD in weekDates that matches standing dayOfWeek (0=Sun…6=Sat). */
function dateKeyForDayOfWeek(weekDates: string[], dayOfWeek: number): string | null {
  for (const dateKey of weekDates) {
    if (getEasternDayOfWeek(parseEasternDate(dateKey)) === dayOfWeek) return dateKey;
  }
  return weekDates[0] ?? null;
}

export function ScheduleViewsClient({
  weekNum,
  scholars: initialScholars,
}: ScheduleViewsClientProps) {
  const weekDates = useMemo(() => weekdayDatesForCampusWeek(weekNum), [weekNum]);

  const [viewMode, setViewMode] = useState<ScheduleViewMode>("week");
  const [kind, setKind] = useState<SessionKind>("front_desk");
  const [selectedDate, setSelectedDate] = useState<string>(
    () => weekDates[0] ?? "",
  );
  const [selectedScholar, setSelectedScholar] = useState<BoardScholar | null>(
    null,
  );
  const [shiftsScholarUid, setShiftsScholarUid] = useState<string | null>(null);
  /** Staged manage-shifts edits — only merge into draftScholars on Save and close. */
  const [manageDraft, setManageDraft] = useState<BoardScholar | null>(null);
  const [draftScholars, setDraftScholars] = useState(() =>
    cloneScholars(initialScholars),
  );
  const [baseline, setBaseline] = useState(() =>
    JSON.stringify(initialScholars),
  );
  const [editDraft, setEditDraft] = useState<ShiftEditDraft | null>(null);
  /** Which surface owns the open ShiftEditDialog. */
  const [editTarget, setEditTarget] = useState<"board" | "manage">("board");
  const [manageSaving, setManageSaving] = useState(false);
  const [manageSaveError, setManageSaveError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  useEffect(() => {
    const next = cloneScholars(initialScholars);
    setDraftScholars(next);
    setBaseline(JSON.stringify(initialScholars));
    setPublishError(null);
  }, [initialScholars]);

  useEffect(() => {
    // Campus week URL change → land on that week's Monday.
    if (weekDates[0]) setSelectedDate(weekDates[0]);
  }, [weekNum, weekDates]);

  const dirty = JSON.stringify(draftScholars) !== baseline;

  const eligible = useMemo(
    () => filterScholarsForKind(draftScholars, kind),
    [draftScholars, kind],
  );

  const dayShifts = useDayShifts(draftScholars, kind, selectedDate);

  const defaultShiftDate = selectedDate || weekDates[0] || "";

  function goToDay(date: string) {
    setSelectedDate(date);
    setViewMode("day");
  }

  function openManageShifts(scholar: BoardScholar) {
    const live = draftScholars.find((s) => s.uid === scholar.uid) ?? scholar;
    setManageSaveError(null);
    setManageDraft(cloneScholar(live));
    setShiftsScholarUid(scholar.uid);
  }

  function discardManageShifts(uid?: string | null) {
    const manageUid = uid ?? manageDraft?.uid ?? shiftsScholarUid;
    setShiftsScholarUid(null);
    setManageDraft(null);
    setManageSaving(false);
    setManageSaveError(null);
    setEditTarget("board");
    setEditDraft((current) =>
      current && manageUid && current.scholarUid === manageUid ? null : current,
    );
  }

  async function saveManageShiftsAndClose() {
    if (!manageDraft) {
      discardManageShifts();
      return;
    }
    setManageSaving(true);
    setManageSaveError(null);
    const result = await backendPut<ReplaceScholarShiftsResponse>(
      `/api/dev/schedule-board/${encodeURIComponent(manageDraft.uid)}`,
      { shifts: shiftWritePayload(manageDraft.shifts) },
    );
    if (!result.ok) {
      setManageSaving(false);
      setManageSaveError(result.error || "Failed to save shifts");
      return;
    }
    const committed = withServerShifts(manageDraft, result.data.shifts);
    setDraftScholars((rows) => replaceScholarInList(rows, committed));
    setBaseline((current) => replaceScholarInBaseline(current, committed));
    discardManageShifts(committed.uid);
  }

  async function publishDraftScholars() {
    if (!dirty || publishing) return;
    setPublishing(true);
    setPublishError(null);

    const baseRows = JSON.parse(baseline) as BoardScholar[];
    const baseByUid = new Map(baseRows.map((row) => [row.uid, row]));
    const dirtyScholars = draftScholars.filter(
      (row) => JSON.stringify(row) !== JSON.stringify(baseByUid.get(row.uid)),
    );

    let nextRows = draftScholars;
    let nextBaseline = baseline;
    for (const scholar of dirtyScholars) {
      const result = await backendPut<ReplaceScholarShiftsResponse>(
        `/api/dev/schedule-board/${encodeURIComponent(scholar.uid)}`,
        { shifts: shiftWritePayload(scholar.shifts) },
      );
      if (!result.ok) {
        setDraftScholars(nextRows);
        setBaseline(nextBaseline);
        setPublishing(false);
        setPublishError(
          result.error || `Failed to publish shifts for ${scholar.name}`,
        );
        return;
      }
      const committed = withServerShifts(scholar, result.data.shifts);
      nextRows = replaceScholarInList(nextRows, committed);
      nextBaseline = replaceScholarInBaseline(nextBaseline, committed);
    }

    setDraftScholars(nextRows);
    setBaseline(nextBaseline);
    setPublishing(false);
  }

  function upsertShift(
    scholarUid: string,
    shift: StandingShift,
    replaceId?: string,
  ) {
    setDraftScholars((rows) =>
      rows.map((row) =>
        row.uid !== scholarUid
          ? row
          : withUpsertedShift(row, shift, replaceId),
      ),
    );
  }

  function removeShift(scholarUid: string, shiftId: string) {
    setDraftScholars((rows) =>
      rows.map((row) =>
        row.uid !== scholarUid ? row : withRemovedShift(row, shiftId),
      ),
    );
  }

  const dayActions: ScheduleBoardActions = {
    onAddShift: ({ scholarUid, date, kind: shiftKind }) => {
      const scholar = draftScholars.find((s) => s.uid === scholarUid);
      if (!scholar) return;
      setEditTarget("board");
      setEditDraft({
        mode: "add",
        scholarUid,
        scholarName: scholar.name,
        date,
        kind: shiftKind,
        startTime: "09:00",
        endTime: "10:00",
      });
    },
    onEditShift: (block) => {
      setEditTarget("board");
      setEditDraft(draftFromBlock(block));
    },
    onPublish: () => {
      void publishDraftScholars();
    },
  };

  function handleSaveDraft(draft: ShiftEditDraft) {
    const dayOfWeek = getEasternDayOfWeek(parseEasternDate(draft.date));
    const id =
      draft.shiftId ??
      `${draft.scholarUid}:${draft.kind}:${dayOfWeek}:${draft.startTime}:${Date.now()}`;
    const shift: StandingShift = {
      id,
      kind: draft.kind,
      dayOfWeek,
      startTime: draft.startTime,
      endTime: draft.endTime,
    };
    const replaceId = draft.mode === "edit" ? draft.shiftId : undefined;

    if (editTarget === "manage" && manageDraft?.uid === draft.scholarUid) {
      setManageDraft((current) =>
        current ? withUpsertedShift(current, shift, replaceId) : current,
      );
      return;
    }
    upsertShift(draft.scholarUid, shift, replaceId);
  }

  function handleDeleteDraft(draft: ShiftEditDraft) {
    if (!draft.shiftId) return;
    if (editTarget === "manage" && manageDraft?.uid === draft.scholarUid) {
      setManageDraft((current) =>
        current ? withRemovedShift(current, draft.shiftId!) : current,
      );
      return;
    }
    removeShift(draft.scholarUid, draft.shiftId);
  }

  function openManageAdd(scholar: BoardScholar, dayOfWeek?: number) {
    const date =
      dayOfWeek != null
        ? (dateKeyForDayOfWeek(weekDates, dayOfWeek) ?? defaultShiftDate)
        : defaultShiftDate;
    setEditTarget("manage");
    setEditDraft({
      mode: "add",
      scholarUid: scholar.uid,
      scholarName: scholar.name,
      date,
      kind,
      startTime: "09:00",
      endTime: "10:00",
    });
  }

  function openManageEdit(scholar: BoardScholar, shift: StandingShift) {
    const date =
      dateKeyForDayOfWeek(weekDates, shift.dayOfWeek) ?? defaultShiftDate;
    setEditTarget("manage");
    setEditDraft({
      mode: "edit",
      scholarUid: scholar.uid,
      scholarName: scholar.name,
      date,
      kind: shift.kind,
      shiftId: shift.id,
      startTime: shift.startTime,
      endTime: shift.endTime,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            label="View"
            value={viewMode}
            options={[
              { value: "week", label: "Week" },
              { value: "day", label: "Day" },
            ]}
            onChange={(v) => setViewMode(v as ScheduleViewMode)}
          />
          <ToggleGroup
            label="Kind"
            value={kind}
            options={[
              {
                value: "front_desk",
                label: "Front Desk",
                activeClass: "bg-front-desk text-white",
              },
              {
                value: "study_session",
                label: "Study Session",
                activeClass: "bg-study text-white",
              },
            ]}
            onChange={(v) => setKind(v as SessionKind)}
          />
        </div>

        {viewMode === "day" ? (
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              {dirty ? (
                <span className="text-xs text-muted-foreground">
                  Unsaved changes
                </span>
              ) : null}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      type="button"
                      disabled={!dirty || publishing}
                      onClick={() => dayActions.onPublish?.()}
                      title={
                        dirty
                          ? "Persist standing shifts for changed scholars"
                          : "No changes to publish"
                      }
                    >
                      {publishing ? "Publishing…" : "Publish"}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {dirty
                    ? "Writes standing shifts to the active semester"
                    : "No changes to publish"}
                </TooltipContent>
              </Tooltip>
            </div>
            {publishError ? (
              <p className="max-w-sm text-right text-xs text-destructive" role="alert">
                {publishError}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">
        Showing {eligible.length} eligible scholar
        {eligible.length === 1 ? "" : "s"} for {kindLabel(kind)} (hour-eligible
        cohort + required minutes &gt; 0). Live roster and standing shifts
        {viewMode === "day" ? " — edit on Day" : ""}.
      </p>

      {viewMode === "week" ? (
        <WeeklyBoard
          scholars={eligible}
          weekDates={weekDates}
          kind={kind}
          onViewHistory={setSelectedScholar}
          onManageShifts={openManageShifts}
        />
      ) : (
        <DailyBoard
          scholars={eligible}
          blocks={dayShifts.blocks}
          kind={kind}
          loading={dayShifts.loading}
          dateLabel={selectedDate ? formatDateHeading(selectedDate) : "—"}
          weekDates={weekDates}
          selectedDate={selectedDate}
          onSelectDate={goToDay}
          onViewHistory={setSelectedScholar}
          onManageShifts={openManageShifts}
          actions={dayActions}
        />
      )}

      <ScholarReviewModal
        uid={selectedScholar?.uid ?? null}
        name={selectedScholar?.name ?? null}
        weekNum={weekNum}
        open={selectedScholar != null}
        onOpenChange={(open) => {
          if (!open) setSelectedScholar(null);
        }}
      />

      <ScholarShiftsModal
        scholar={manageDraft}
        kind={kind}
        open={shiftsScholarUid != null}
        onOpenChange={(open) => {
          if (!open && !manageSaving) discardManageShifts();
        }}
        onAdd={(dayOfWeek) => {
          if (manageDraft) openManageAdd(manageDraft, dayOfWeek);
        }}
        onEdit={(shift) => {
          if (manageDraft) openManageEdit(manageDraft, shift);
        }}
        onMove={(shift, next) => {
          setManageDraft((current) =>
            current
              ? withUpsertedShift(
                  current,
                  {
                    ...shift,
                    dayOfWeek: next.dayOfWeek,
                    startTime: next.startTime,
                    endTime: next.endTime,
                  },
                  shift.id,
                )
              : current,
          );
        }}
        onSaveAndClose={saveManageShiftsAndClose}
        saving={manageSaving}
        saveError={manageSaveError}
      />

      <ShiftEditDialog
        draft={editDraft}
        open={editDraft != null}
        onOpenChange={(open) => {
          if (!open) setEditDraft(null);
        }}
        onSave={handleSaveDraft}
        onDelete={handleDeleteDraft}
      />
    </div>
  );
}

function ToggleGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; activeClass?: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="inline-flex rounded-md border bg-background p-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded px-2.5 py-1 text-sm transition-colors",
              value === opt.value
                ? (opt.activeClass ?? "bg-primary text-primary-foreground")
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
