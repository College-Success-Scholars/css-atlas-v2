"use client";

import { cn } from "@/lib/utils";
import { formatWeekdayColumn } from "./schedule-helpers";

type WeekDayBarProps = {
  weekDates: string[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
};

/** Mon–Fri picker for the current campus week (day view chrome). */
export function WeekDayBar({
  weekDates,
  selectedDate,
  onSelectDate,
}: WeekDayBarProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-1"
      role="group"
      aria-label="Weekday"
    >
      {weekDates.map((dateKey) => {
        const { weekday, dayNum } = formatWeekdayColumn(dateKey);
        const isSelected = selectedDate === dateKey;
        return (
          <button
            key={dateKey}
            type="button"
            onClick={() => onSelectDate(dateKey)}
            aria-pressed={isSelected}
            aria-label={`${weekday} ${dayNum}`}
            className={cn(
              "flex min-w-[4.5rem] flex-col items-center rounded-md px-2 py-1 font-medium transition-colors",
              isSelected
                ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                : "hover:bg-muted",
            )}
          >
            <span>{weekday}</span>
            <span
              className={cn(
                "tabular-nums",
                isSelected ? "text-primary/80" : "text-muted-foreground",
              )}
            >
              {dayNum}
            </span>
          </button>
        );
      })}
    </div>
  );
}
