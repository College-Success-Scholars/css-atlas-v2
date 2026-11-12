"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  formatDurationLabel,
  kindLabel,
  parseHhMm,
  sessionKindSurfaceClass,
} from "./schedule-helpers";
import type { BoardScholar, SessionKind, StandingShift } from "./types";

/** Campus schedule days (Mon–Fri). */
const DAY_ROWS = [
  { dayOfWeek: 1, label: "Mon" },
  { dayOfWeek: 2, label: "Tue" },
  { dayOfWeek: 3, label: "Wed" },
  { dayOfWeek: 4, label: "Thu" },
  { dayOfWeek: 5, label: "Fri" },
] as const;

const AXIS_START_MIN = 8 * 60;
const AXIS_END_MIN = 20 * 60;
const AXIS_SPAN = AXIS_END_MIN - AXIS_START_MIN;
const HOUR_TICKS = Array.from(
  { length: (AXIS_END_MIN - AXIS_START_MIN) / 60 + 1 },
  (_, i) => AXIS_START_MIN / 60 + i,
);
const SNAP_MINUTES = 15;
const DRAG_THRESHOLD_PX = 4;

type ScholarShiftsModalProps = {
  scholar: BoardScholar | null;
  kind: SessionKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefer passing dayOfWeek so the new shift lands on that row. */
  onAdd: (dayOfWeek?: number) => void;
  onEdit: (shift: StandingShift) => void;
  onMove: (
    shift: StandingShift,
    next: { dayOfWeek: number; startTime: string; endTime: string },
  ) => void;
  /** Persist staged modal edits, then close on success. */
  onSaveAndClose: () => void | Promise<void>;
  saving?: boolean;
  saveError?: string | null;
};

type InteractionMode = "move" | "resize-start" | "resize-end";

type DragState = {
  mode: InteractionMode;
  shift: StandingShift;
  pointerId: number;
  originX: number;
  originY: number;
  /** Pointer offset from block start (move mode only). */
  grabOffsetMin: number;
  /** Fixed duration while moving the whole block. */
  fixedDurationMin: number;
  dayOfWeek: number;
  startMin: number;
  endMin: number;
  moved: boolean;
};

function hourLabel(hour: number): string {
  if (hour === 0) return "12am";
  if (hour < 12) return `${hour}am`;
  if (hour === 12) return "12pm";
  return `${hour - 12}pm`;
}

function minutesToHhMm(mins: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(mins)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function snapMinutes(mins: number, step = SNAP_MINUTES): number {
  return Math.round(mins / step) * step;
}

function barStyle(startTime: string, endTime: string): CSSProperties {
  const start = Math.max(AXIS_START_MIN, parseHhMm(startTime));
  const end = Math.min(AXIS_END_MIN, parseHhMm(endTime));
  const left = ((start - AXIS_START_MIN) / AXIS_SPAN) * 100;
  const width = Math.max(2, ((end - start) / AXIS_SPAN) * 100);
  return { left: `${left}%`, width: `${width}%` };
}

function barStyleFromMinutes(startMin: number, endMin: number): CSSProperties {
  const start = Math.max(AXIS_START_MIN, startMin);
  const end = Math.min(AXIS_END_MIN, endMin);
  const left = ((start - AXIS_START_MIN) / AXIS_SPAN) * 100;
  const width = Math.max(2, ((end - start) / AXIS_SPAN) * 100);
  return { left: `${left}%`, width: `${width}%` };
}

function minutesFromTrackX(track: HTMLElement, clientX: number): number {
  const rect = track.getBoundingClientRect();
  const pad = 8; // matches px-2
  const usable = Math.max(1, rect.width - pad * 2);
  const x = Math.min(Math.max(clientX - rect.left - pad, 0), usable);
  return AXIS_START_MIN + (x / usable) * AXIS_SPAN;
}

function dayOfWeekFromPoint(clientX: number, clientY: number): number | null {
  const el = document.elementFromPoint(clientX, clientY);
  if (!(el instanceof Element)) return null;
  const row = el.closest("[data-day-of-week]");
  if (!row) return null;
  const raw = row.getAttribute("data-day-of-week");
  const n = raw != null ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

function trackFromDay(dayOfWeek: number): HTMLElement | null {
  return document.querySelector(
    `[data-day-track="${dayOfWeek}"]`,
  ) as HTMLElement | null;
}

export function ScholarShiftsModal({
  scholar,
  kind,
  open,
  onOpenChange,
  onAdd,
  onEdit,
  onMove,
  onSaveAndClose,
  saving = false,
  saveError = null,
}: ScholarShiftsModalProps) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const shiftsByDay = useMemo(() => {
    const map = new Map<number, StandingShift[]>();
    for (const row of DAY_ROWS) map.set(row.dayOfWeek, []);
    if (!scholar) return map;
    for (const shift of scholar.shifts) {
      if (shift.kind !== kind) continue;
      const list = map.get(shift.dayOfWeek);
      if (!list) continue;
      list.push(shift);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [scholar, kind]);

  useEffect(() => {
    if (!drag) return;

    function onPointerMove(event: PointerEvent) {
      const current = dragRef.current;
      if (!current || event.pointerId !== current.pointerId) return;

      const dx = event.clientX - current.originX;
      const dy = event.clientY - current.originY;
      const moved =
        current.moved || Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX;

      if (current.mode === "move") {
        const day =
          dayOfWeekFromPoint(event.clientX, event.clientY) ?? current.dayOfWeek;
        const track = trackFromDay(day);
        if (!track) return;

        const pointerMin = minutesFromTrackX(track, event.clientX);
        let startMin = snapMinutes(pointerMin - current.grabOffsetMin);
        startMin = Math.max(
          AXIS_START_MIN,
          Math.min(startMin, AXIS_END_MIN - current.fixedDurationMin),
        );
        const next: DragState = {
          ...current,
          dayOfWeek: day,
          startMin,
          endMin: startMin + current.fixedDurationMin,
          moved,
        };
        dragRef.current = next;
        setDrag(next);
        return;
      }

      // Resize stays on the original day.
      const track = trackFromDay(current.dayOfWeek);
      if (!track) return;
      const pointerMin = snapMinutes(minutesFromTrackX(track, event.clientX));

      let startMin = current.startMin;
      let endMin = current.endMin;
      if (current.mode === "resize-start") {
        startMin = Math.max(
          AXIS_START_MIN,
          Math.min(pointerMin, endMin - SNAP_MINUTES),
        );
      } else {
        endMin = Math.min(
          AXIS_END_MIN,
          Math.max(pointerMin, startMin + SNAP_MINUTES),
        );
      }

      const next: DragState = {
        ...current,
        startMin,
        endMin,
        moved,
      };
      dragRef.current = next;
      setDrag(next);
    }

    function onPointerUp(event: PointerEvent) {
      const current = dragRef.current;
      if (!current || event.pointerId !== current.pointerId) return;

      dragRef.current = null;
      setDrag(null);

      if (!current.moved) {
        if (current.mode === "move") onEdit(current.shift);
        return;
      }

      const startTime = minutesToHhMm(current.startMin);
      const endTime = minutesToHhMm(current.endMin);
      if (
        current.dayOfWeek === current.shift.dayOfWeek &&
        startTime === current.shift.startTime &&
        endTime === current.shift.endTime
      ) {
        return;
      }
      onMove(current.shift, {
        dayOfWeek: current.dayOfWeek,
        startTime,
        endTime,
      });
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [drag, onEdit, onMove]);

  function beginInteraction(
    event: ReactPointerEvent<HTMLElement>,
    shift: StandingShift,
    mode: InteractionMode,
  ) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const track = trackFromDay(shift.dayOfWeek);
    if (!track) return;

    const startMin = parseHhMm(shift.startTime);
    const endMin = parseHhMm(shift.endTime);
    const fixedDurationMin = Math.max(SNAP_MINUTES, endMin - startMin);
    const pointerMin = minutesFromTrackX(track, event.clientX);
    const next: DragState = {
      mode,
      shift,
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      grabOffsetMin: pointerMin - startMin,
      fixedDurationMin,
      dayOfWeek: shift.dayOfWeek,
      startMin,
      endMin,
      moved: false,
    };
    dragRef.current = next;
    setDrag(next);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl flex-col gap-4 overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Manage shifts</DialogTitle>
          <DialogDescription>
            {scholar
              ? `${scholar.name} · ${kindLabel(kind)} — drag to move, drag edges to extend; click to edit`
              : "Standing assignments"}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto rounded-lg border bg-background">
          <div className="min-w-[560px]">
            <div className="grid grid-cols-[3.5rem_1fr] border-b bg-muted/40">
              <div className="px-2 py-2 text-xs font-medium text-muted-foreground">
                Day
              </div>
              <div className="relative px-2 py-2">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  {HOUR_TICKS.map((hour) => (
                    <span key={hour} className="tabular-nums">
                      {hourLabel(hour)}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {DAY_ROWS.map((row) => {
              const dayShifts = shiftsByDay.get(row.dayOfWeek) ?? [];
              const showGhost =
                drag?.moved && drag.dayOfWeek === row.dayOfWeek
                  ? drag
                  : null;
              return (
                <div
                  key={row.dayOfWeek}
                  data-day-of-week={row.dayOfWeek}
                  className={cn(
                    "group/day grid grid-cols-[3.5rem_1fr] items-stretch border-b last:border-b-0",
                    showGhost && "bg-primary/5",
                  )}
                >
                  <div className="flex items-center px-2 py-2 text-sm font-medium">
                    {row.label}
                  </div>
                  <div
                    data-day-track={row.dayOfWeek}
                    className="relative min-h-12 border-l px-2 py-1.5"
                  >
                    {dayShifts.map((shift) => {
                      const hours =
                        (parseHhMm(shift.endTime) - parseHhMm(shift.startTime)) /
                        60;
                      const isSource =
                        drag?.shift.id === shift.id && drag.moved;
                      return (
                        <div
                          key={shift.id}
                          role="button"
                          tabIndex={0}
                          onPointerDown={(e) =>
                            beginInteraction(e, shift, "move")
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onEdit(shift);
                            }
                          }}
                          className={cn(
                            "absolute top-1/2 z-10 flex h-7 -translate-y-1/2 touch-none items-center overflow-hidden rounded-md border px-2 text-[10px] font-medium shadow-xs select-none",
                            sessionKindSurfaceClass(kind, hours),
                            "cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-primary/40",
                            isSource && "opacity-30",
                          )}
                          style={barStyle(shift.startTime, shift.endTime)}
                          title={`${shift.startTime}–${shift.endTime} · ${formatDurationLabel(hours)} · drag to move, edges to resize`}
                        >
                          <span
                            aria-hidden
                            onPointerDown={(e) =>
                              beginInteraction(e, shift, "resize-start")
                            }
                            className="absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize hover:bg-foreground/15"
                            title="Drag to change start"
                          />
                          <span className="pointer-events-none truncate tabular-nums">
                            {shift.startTime}–{shift.endTime}
                          </span>
                          <span
                            aria-hidden
                            onPointerDown={(e) =>
                              beginInteraction(e, shift, "resize-end")
                            }
                            className="absolute inset-y-0 right-0 z-10 w-2 cursor-ew-resize hover:bg-foreground/15"
                            title="Drag to change end"
                          />
                        </div>
                      );
                    })}
                    {showGhost ? (
                      <div
                        className={cn(
                          "pointer-events-none absolute top-1/2 z-20 flex h-7 -translate-y-1/2 items-center overflow-hidden rounded-md border px-1.5 text-[10px] font-medium shadow-md ring-2 ring-primary/50",
                          sessionKindSurfaceClass(
                            kind,
                            (showGhost.endMin - showGhost.startMin) / 60,
                          ),
                        )}
                        style={barStyleFromMinutes(
                          showGhost.startMin,
                          showGhost.endMin,
                        )}
                        aria-hidden
                      >
                        <span className="truncate tabular-nums">
                          {minutesToHhMm(showGhost.startMin)}–
                          {minutesToHhMm(showGhost.endMin)}
                        </span>
                      </div>
                    ) : null}
                    {dayShifts.length === 0 && !showGhost ? (
                      <button
                        type="button"
                        title={`Add ${row.label} shift`}
                        onClick={() => onAdd(row.dayOfWeek)}
                        className="absolute inset-y-1 left-2 right-2 z-0 flex items-center justify-center rounded-md opacity-0 transition-opacity group-hover/day:opacity-100"
                      >
                        <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                          <Plus className="size-3.5" />
                        </span>
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {saveError ? (
          <p className="text-sm text-destructive" role="alert">
            {saveError}
          </p>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onAdd()}
          >
            <Plus className="size-4" />
            Add shift
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              disabled={saving}
              title="Persist standing shifts for this scholar"
              onClick={() => void onSaveAndClose()}
            >
              {saving ? "Saving…" : "Save and close"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
