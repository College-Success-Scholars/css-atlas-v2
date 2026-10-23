/**
 * @file tutoring-session-dialog.tsx
 * @module frontend/app/dashboard/teams
 *
 * Session detail for one tutor report, with a confirm step before remove.
 * Callers own the delete path (server action).
 */
"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TutorReportWeekRow } from "@/lib/types/tutor-report-log";
import {
  normalizeCourses,
  receiptTimingLabel,
  scholarLabel,
  tutoringSessionSummary,
} from "./tutoring-display";

export { tutoringSessionTimeLabel } from "./tutoring-display";

export type TutoringSessionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: TutorReportWeekRow;
  onDelete: () => Promise<void>;
  weekNum: number;
  position: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
  formsInBlock: number;
  onBusyChange: (busy: boolean) => void;
};

export function TutoringSessionDialog(props: TutoringSessionDialogProps) {
  if (!props.open) return null;

  // A new selected form (or reopening the panel) starts with fresh local state.
  return <TutoringSessionDetails key={props.row.id} {...props} />;
}

function TutoringSessionDetails({
  onOpenChange,
  row,
  onDelete,
  weekNum,
  position,
  total,
  onPrevious,
  onNext,
  formsInBlock,
  onBusyChange,
}: TutoringSessionDialogProps) {
  const headingId = useId();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deleteInFlight = useRef(false);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const removeButton = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);

  useEffect(() => {
    if (confirming) cancelButton.current?.focus();
    else if (wasConfirming.current) removeButton.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.defaultPrevented || submitting) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onOpenChange(false);
      return;
    }

    const target = event.target;
    if (
      confirming ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      (target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest("input, textarea, select, [role='textbox']")))
    ) return;

    if (event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      if (position > 1) onPrevious();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      if (position < total) onNext();
    }
  }

  async function handleConfirmDelete() {
    if (deleteInFlight.current || !confirming) return;
    deleteInFlight.current = true;
    setSubmitting(true);
    setError(null);
    onBusyChange(true);
    try {
      await onDelete();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      deleteInFlight.current = false;
      setSubmitting(false);
      onBusyChange(false);
    }
  }

  return (
    <aside
      id="tutoring-details"
      role="dialog"
      aria-modal={false}
      aria-labelledby={headingId}
      aria-busy={submitting}
      onKeyDown={handleKeyDown}
      className="sticky top-4 min-w-0 max-h-[calc(100dvh-2rem)] space-y-5 overflow-y-auto rounded-lg border bg-card p-4 text-card-foreground"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs text-muted-foreground">Tutoring session form</p>
          <h2 id={headingId} tabIndex={-1} className="break-words text-lg font-semibold">
            {scholarLabel(row)}
          </h2>
          <p className="break-words text-sm text-muted-foreground">
            Tutor: {row.tutor_name || "Unknown tutor"}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Close details"
          disabled={submitting}
          onClick={() => onOpenChange(false)}
        >
          <X aria-hidden="true" />
        </Button>
      </header>

      <div className="space-y-3">
        <p className="text-sm">{tutoringSessionSummary(row)}</p>
        <div className="flex flex-wrap gap-1.5" aria-label="Courses">
          {normalizeCourses(row.courses).map((course) => (
            <Badge key={course} variant="secondary" className="max-w-full whitespace-normal break-words">
              {course}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{receiptTimingLabel(row)}</p>
      </div>

      <nav aria-label="Session forms" className="space-y-2 border-t pt-4">
        <p className="text-center text-xs text-muted-foreground">
          Form {position} of {total}
        </p>
        <div className="flex flex-wrap justify-between gap-2">
          <Button type="button" variant="outline" size="sm" disabled={submitting || confirming || position <= 1} onClick={onPrevious}>
            <ArrowUp aria-hidden="true" />
            Previous form
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={submitting || confirming || position >= total} onClick={onNext}>
            Next form
            <ArrowDown aria-hidden="true" />
          </Button>
        </div>
      </nav>

      <div className="space-y-3 border-t pt-4">
        {confirming ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Remove tutoring session?</h3>
            <p className="text-sm text-muted-foreground">
              This permanently removes one form from Week {weekNum} and from the
              Weekly Memo and Mentee monitoring. This cannot be undone.
            </p>
            {formsInBlock > 1 && (
              <p className="text-sm text-muted-foreground">
                Other reports in the same block will remain. Tutor-hours may stay unchanged.
              </p>
            )}
            {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                ref={cancelButton}
                type="button"
                variant="outline"
                onClick={() => setConfirming(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={submitting}
              >
                {submitting ? "Removing…" : "Remove session"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end">
              <Button
                ref={removeButton}
                type="button"
                variant="destructive"
                onClick={() => setConfirming(true)}
                disabled={submitting}
              >
                Remove
              </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
