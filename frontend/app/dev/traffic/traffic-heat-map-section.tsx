"use client";

import { useState } from "react";
import type { TrafficSession } from "@css-atlas/shared/contracts/traffic";
import { TrafficHeatMap } from "./traffic-heat-map";

const SLOT_OPTIONS = [15, 30, 60] as const;

interface TrafficHeatMapSectionProps {
  sessions: readonly TrafficSession[];
  /** Initial slot size from URL (default 15). */
  initialSlotMinutes?: number;
}

export function TrafficHeatMapSection({
  sessions,
  initialSlotMinutes = 15,
}: TrafficHeatMapSectionProps) {
  const slotMinutes = [15, 30, 60].includes(initialSlotMinutes)
    ? initialSlotMinutes
    : 15;
  const [selectedSlot, setSelectedSlot] = useState(slotMinutes);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Heat map slot size:</span>
        {SLOT_OPTIONS.map((inc) => (
          <button
            key={inc}
            type="button"
            onClick={() => setSelectedSlot(inc)}
            className={`inline-flex h-8 min-w-16 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors ${
              selectedSlot === inc
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            }`}
          >
            {inc === 60 ? "1 hour" : `${inc} min`}
          </button>
        ))}
      </div>
      {SLOT_OPTIONS.map((inc) => (
        <div
          key={inc}
          className={selectedSlot === inc ? "block" : "hidden"}
          aria-hidden={selectedSlot !== inc}
        >
          <TrafficHeatMap sessions={sessions} slotMinutes={inc} />
        </div>
      ))}
    </div>
  );
}
