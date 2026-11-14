import { useCallback, useEffect, useMemo, useState } from "react";
import type { DirectoryPerson, DirectorySort } from "./directory-state";

/**
 * Directory pins live in this browser, one list per signed-in user. Each pin
 * keeps a snapshot of the row so pinned people show up whatever the current
 * search, filters or page; snapshots refresh whenever the person is loaded.
 */
const STORAGE_PREFIX = "directory:pins:";

function isDirectoryPerson(value: unknown): value is DirectoryPerson {
  if (!value || typeof value !== "object") return false;
  const person = value as Record<string, unknown>;
  return typeof person.id === "string" && typeof person.name === "string" && Array.isArray(person.teams);
}

export function readPins(viewerId: string): DirectoryPerson[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + viewerId);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isDirectoryPerson) : [];
  } catch {
    return [];
  }
}

export function writePins(viewerId: string, pins: DirectoryPerson[]): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + viewerId, JSON.stringify(pins));
  } catch {
    // Storage can be full or blocked; pins then last until the page reloads.
  }
}

export function togglePin(pins: DirectoryPerson[], person: DirectoryPerson): DirectoryPerson[] {
  return pins.some((pin) => pin.id === person.id)
    ? pins.filter((pin) => pin.id !== person.id)
    : [...pins, person];
}

/** Swaps in fresher rows for pinned people; returns `pins` itself when nothing changed. */
export function refreshPins(pins: DirectoryPerson[], seen: DirectoryPerson[]): DirectoryPerson[] {
  if (pins.length === 0 || seen.length === 0) return pins;
  const latest = new Map(seen.map((person) => [person.id, person]));
  let changed = false;
  const next = pins.map((pin) => {
    const fresh = latest.get(pin.id);
    if (!fresh || JSON.stringify(fresh) === JSON.stringify(pin)) return pin;
    changed = true;
    return fresh;
  });
  return changed ? next : pins;
}

export function sortPins(pins: DirectoryPerson[], sort: DirectorySort): DirectoryPerson[] {
  const sorted = [...pins].sort((a, b) => a.name.localeCompare(b.name));
  return sort === "desc" ? sorted.reverse() : sorted;
}

export function useDirectoryPins(viewerId: string | null) {
  const [pins, setPins] = useState<{ loaded: boolean; people: DirectoryPerson[] }>({ loaded: false, people: [] });

  useEffect(() => {
    // Storage only exists in the browser, so pins load after the first render.
    setPins({ loaded: true, people: viewerId ? readPins(viewerId) : [] });
  }, [viewerId]);

  useEffect(() => {
    if (pins.loaded && viewerId) writePins(viewerId, pins.people);
  }, [pins, viewerId]);

  const toggle = useCallback((person: DirectoryPerson) => {
    setPins((current) => ({ ...current, people: togglePin(current.people, person) }));
  }, []);

  const refresh = useCallback((seen: DirectoryPerson[]) => {
    setPins((current) => {
      const people = refreshPins(current.people, seen);
      return people === current.people ? current : { ...current, people };
    });
  }, []);

  const pinnedIds = useMemo(() => new Set(pins.people.map((person) => person.id)), [pins.people]);

  return { pinned: pins.people, pinnedIds, toggle, refresh };
}
