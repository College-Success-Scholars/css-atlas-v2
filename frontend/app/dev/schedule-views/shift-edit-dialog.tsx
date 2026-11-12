"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { kindLabel, parseHhMm } from "./schedule-helpers";
import type { DayShiftBlock, SessionKind } from "./types";

export type ShiftEditDraft = {
  mode: "add" | "edit";
  scholarUid: string;
  scholarName: string;
  date: string;
  kind: SessionKind;
  /** Present when editing an existing standing shift. */
  shiftId?: string;
  startTime: string;
  endTime: string;
};

type ShiftEditDialogProps = {
  draft: ShiftEditDraft | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (draft: ShiftEditDraft) => void;
  onDelete?: (draft: ShiftEditDraft) => void;
};

function fromBlock(block: DayShiftBlock): ShiftEditDraft {
  return {
    mode: "edit",
    scholarUid: block.scholarUid,
    scholarName: block.scholarName,
    date: block.date,
    kind: block.kind,
    shiftId: block.id,
    startTime: block.startTime,
    endTime: block.endTime,
  };
}

export function draftFromBlock(block: DayShiftBlock): ShiftEditDraft {
  return fromBlock(block);
}

export function ShiftEditDialog({
  draft,
  open,
  onOpenChange,
  onSave,
  onDelete,
}: ShiftEditDialogProps) {
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!draft) return;
    setStartTime(draft.startTime);
    setEndTime(draft.endTime);
    setError(null);
  }, [draft]);

  function handleSave() {
    if (!draft) return;
    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
      setError("Use HH:MM times.");
      return;
    }
    if (parseHhMm(endTime) <= parseHhMm(startTime)) {
      setError("End time must be after start time.");
      return;
    }
    onSave({ ...draft, startTime, endTime });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {draft?.mode === "edit" ? "Edit shift" : "Add shift"}
          </DialogTitle>
          <DialogDescription>
            {draft
              ? `${draft.scholarName} · ${kindLabel(draft.kind)} · ${draft.date}`
              : "Shift"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="shift-start">Start</Label>
            <Input
              id="shift-start"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shift-end">End</Label>
            <Input
              id="shift-end"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          {draft?.mode === "edit" && onDelete ? (
            <Button
              type="button"
              variant="destructive"
              className="sm:mr-auto"
              onClick={() => {
                onDelete(draft);
                onOpenChange(false);
              }}
            >
              Delete
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
