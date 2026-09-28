/**
 * @file tutoring-session-dialog.tsx
 * @module frontend/app/dashboard/teams
 *
 * Session detail for one tutor report, with a confirm step before remove.
 * Callers own the delete path (server action).
 */
"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatEntryDate } from "@/lib/format/time";
import type { TutorReportWeekRow } from "@/lib/types/tutor-report-log";

export type TutoringSessionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: TutorReportWeekRow;
  onDelete: () => Promise<void>;
};

export function tutoringSessionTimeLabel(row: TutorReportWeekRow): string {
  return `${row.start_time} – ${row.end_time}`;
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{value || "—"}</dd>
    </div>
  );
}

export function TutoringSessionDialog({
  open,
  onOpenChange,
  row,
  onDelete,
}: TutoringSessionDialogProps) {
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setConfirming(false);
      setError(null);
    }
  }, [open, row.id]);

  async function handleConfirmDelete() {
    setSubmitting(true);
    setError(null);
    try {
      await onDelete();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  const timeLabel = tutoringSessionTimeLabel(row);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {confirming ? (
          <>
            <DialogHeader>
              <DialogTitle>Remove tutoring session?</DialogTitle>
              <DialogDescription>
                This permanently deletes the form for {row.scholar_name} with{" "}
                {row.tutor_name} ({row.day_of_week} {timeLabel}). It will also
                disappear from the Weekly Memo and Mentee monitoring.
              </DialogDescription>
            </DialogHeader>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <DialogFooter>
              <Button
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
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{row.scholar_name}</DialogTitle>
              <DialogDescription>Tutoring session form</DialogDescription>
            </DialogHeader>
            <dl className="space-y-2">
              <DetailItem label="Scholar" value={row.scholar_name} />
              <DetailItem label="Scholar UID" value={row.scholar_uid ?? ""} />
              <DetailItem label="Tutor" value={row.tutor_name} />
              <DetailItem label="Courses" value={row.courses.join(", ")} />
              <DetailItem label="Session date" value={row.date ?? ""} />
              <DetailItem label="Day" value={row.day_of_week} />
              <DetailItem label="Start time" value={row.start_time} />
              <DetailItem label="End time" value={row.end_time} />
              <DetailItem
                label="Submitted"
                value={row.created_at ? formatEntryDate(row.created_at, true) : ""}
              />
            </dl>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setConfirming(true)}
              >
                Remove
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
