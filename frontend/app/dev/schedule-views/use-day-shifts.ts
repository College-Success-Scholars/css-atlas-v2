"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addCalendarDaysToDateKey, expandDayShifts } from "./schedule-helpers";
import type { BoardScholar, DayShiftBlock, SessionKind } from "./types";

type CacheKey = string;

function cacheKey(date: string, kind: SessionKind): CacheKey {
  return `${kind}:${date}`;
}

export type DayShiftsState = {
  blocks: DayShiftBlock[];
  loading: boolean;
  prefetchReady: { prev: boolean; next: boolean };
  loadDay: (date: string) => Promise<void>;
};

/**
 * Selected-day-first loader with ±1 day prefetch into an in-memory cache.
 * Expands standing shifts for the current scholar draft (clears on roster change).
 */
export function useDayShifts(
  scholars: BoardScholar[],
  kind: SessionKind,
  selectedDate: string,
): DayShiftsState {
  const cacheRef = useRef<Map<CacheKey, DayShiftBlock[]>>(new Map());
  const [blocks, setBlocks] = useState<DayShiftBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [prefetchReady, setPrefetchReady] = useState({ prev: false, next: false });

  useEffect(() => {
    cacheRef.current.clear();
  }, [scholars]);

  const ensureCached = useCallback(
    async (date: string): Promise<DayShiftBlock[]> => {
      const key = cacheKey(date, kind);
      const hit = cacheRef.current.get(key);
      if (hit) return hit;
      const loaded = expandDayShifts(scholars, date, kind);
      cacheRef.current.set(key, loaded);
      return loaded;
    },
    [kind, scholars],
  );

  const refreshPrefetchFlags = useCallback(
    (date: string) => {
      const prev = addCalendarDaysToDateKey(date, -1);
      const next = addCalendarDaysToDateKey(date, 1);
      setPrefetchReady({
        prev: cacheRef.current.has(cacheKey(prev, kind)),
        next: cacheRef.current.has(cacheKey(next, kind)),
      });
    },
    [kind],
  );

  const loadDay = useCallback(
    async (date: string) => {
      setLoading(true);
      try {
        const selected = await ensureCached(date);
        setBlocks(selected);
        setLoading(false);
        refreshPrefetchFlags(date);

        const prev = addCalendarDaysToDateKey(date, -1);
        const next = addCalendarDaysToDateKey(date, 1);
        void Promise.all([ensureCached(prev), ensureCached(next)]).then(() => {
          refreshPrefetchFlags(date);
        });
      } catch {
        setBlocks([]);
        setLoading(false);
      }
    },
    [ensureCached, refreshPrefetchFlags],
  );

  useEffect(() => {
    if (!selectedDate) {
      setBlocks([]);
      setLoading(false);
      return;
    }
    void loadDay(selectedDate);
  }, [selectedDate, kind, loadDay]);

  return { blocks, loading, prefetchReady, loadDay };
}
