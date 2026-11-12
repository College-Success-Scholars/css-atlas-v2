"use client";

import { CalendarClock, History, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ScholarRowMenuProps = {
  onViewHistory: () => void;
  onManageShifts: () => void;
};

/** Per-row ⋮ tools: history review or manage standing shifts. */
export function ScholarRowMenu({
  onViewHistory,
  onManageShifts,
}: ScholarRowMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          aria-label="Scholar tools"
          title="Scholar tools"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem onClick={onViewHistory}>
          <History className="size-4" />
          View history
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onManageShifts}>
          <CalendarClock className="size-4" />
          Manage shifts
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
