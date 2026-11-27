// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { readPins, refreshPins, sortPins, togglePin, writePins } from "./directory-pins";
import type { DirectoryPerson } from "./directory-state";

const person = (id: string, name: string, email: string | null = null): DirectoryPerson => ({
  id,
  name,
  uid: id,
  cohort: 2024,
  email,
  phoneNumber: null,
  teams: [],
  programRole: null,
  isMentee: false,
});

describe("directory pins", () => {
  afterEach(() => localStorage.clear());

  it("keeps each viewer's pins apart", () => {
    writePins("viewer-a", [person("1", "Ada")]);
    expect(readPins("viewer-a").map((p) => p.id)).toEqual(["1"]);
    expect(readPins("viewer-b")).toEqual([]);
  });

  it("ignores storage it can't read", () => {
    localStorage.setItem("directory:pins:viewer-a", "{not json");
    expect(readPins("viewer-a")).toEqual([]);
    localStorage.setItem("directory:pins:viewer-a", JSON.stringify([{ id: 1 }, person("2", "Grace")]));
    expect(readPins("viewer-a").map((p) => p.id)).toEqual(["2"]);
  });

  it("toggles a person in and out", () => {
    const ada = person("1", "Ada");
    const pinned = togglePin([], ada);
    expect(pinned).toEqual([ada]);
    expect(togglePin(pinned, ada)).toEqual([]);
  });

  it("refreshes snapshots from newly loaded rows and keeps identity when nothing changed", () => {
    const pins = [person("1", "Ada", "old@umd.edu"), person("2", "Grace")];
    const refreshed = refreshPins(pins, [person("1", "Ada", "new@umd.edu"), person("3", "Linus")]);
    expect(refreshed.map((p) => p.email)).toEqual(["new@umd.edu", null]);
    expect(refreshPins(refreshed, [person("2", "Grace")])).toBe(refreshed);
  });

  it("sorts pins the way the directory is sorted", () => {
    const pins = [person("2", "Grace"), person("1", "Ada")];
    expect(sortPins(pins, "asc").map((p) => p.name)).toEqual(["Ada", "Grace"]);
    expect(sortPins(pins, "desc").map((p) => p.name)).toEqual(["Grace", "Ada"]);
  });
});
