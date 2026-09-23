import { describe, expect, it } from "vitest";
import { parseDirectoryQuery } from "../controllers/user.controller.js";
import {
  DirectoryCursorError,
  mapDirectoryPerson,
  queryDirectoryRows,
} from "../services/user.service.js";
import type { DirectoryQuery } from "../models/user.model.js";

const rows = [
  { id: 1, first_name: "Ada", last_name: "Lovelace", email: "ada@example.test", cohort: 2024, teams: ["Blue"], program_role: "Scholar", phone_number: "555-0100", uid: "uid-ada" },
  { id: 2, first_name: "Grace", last_name: "Hopper", email: "grace@example.test", cohort: 2023, teams: ["Blue", "Engineering"], program_role: "Alumni", phone_number: null, uid: "uid-grace" },
  { id: 3, first_name: "Alan", last_name: "Turing", email: "alan@example.test", cohort: 2024, teams: ["Engineering"], program_role: "Scholar", phone_number: null, uid: "uid-alan" },
  { id: 4, first_name: "Barbara", last_name: "Liskov", email: "barbara@example.test", cohort: 2022, teams: null, program_role: "Team Leader", phone_number: null, uid: "uid-barbara" },
];

function query(overrides: Partial<DirectoryQuery> = {}): DirectoryQuery {
  return {
    view: "flat",
    search: "",
    sort: "asc",
    teams: [],
    programRoles: [],
    cohorts: [],
    limit: 24,
    cursor: null,
    group: null,
    ...overrides,
  };
}

describe("directory query contract", () => {
  it("uses a stable directory id, maps phone, and never maps UID or app role", () => {
    const person = mapDirectoryPerson(rows[0]!);

    expect(person).toEqual({
      id: "1",
      name: "Ada Lovelace",
      cohort: 2024,
      email: "ada@example.test",
      phoneNumber: "555-0100",
      teams: ["Blue"],
      programRole: "Scholar",
    });
    expect(person).not.toHaveProperty("uid");
    expect(person).not.toHaveProperty("phone_number");
    expect(person).not.toHaveProperty("app_role");
  });

  it("searches by name, email, or UID without exposing UID on the result", () => {
    const byEmail = queryDirectoryRows(rows, query({ search: "grace@example" }));
    expect(byEmail).toMatchObject({ view: "flat", members: [{ id: "2" }] });

    const byUid = queryDirectoryRows(rows, query({ search: "uid-alan" }));
    expect(byUid).toMatchObject({ view: "flat", members: [{ id: "3" }] });
    expect(byUid.view === "flat" && byUid.members[0]).not.toHaveProperty("uid");
  });

  it("intersects independent team, program-role, and cohort facets", () => {
    const result = queryDirectoryRows(rows, query({
      teams: ["Engineering"],
      programRoles: ["Scholar"],
      cohorts: [2024],
    }));

    expect(result).toMatchObject({ view: "flat", members: [{ id: "3", name: "Alan Turing" }] });
    expect(result.view === "flat" && result.pagination.total).toBe(1);
  });

  it("sorts names, returns an opaque cursor, and traverses the next page", () => {
    const first = queryDirectoryRows(rows, query({ limit: 2, sort: "asc" }));
    expect(first).toMatchObject({ view: "flat", members: [{ id: "1" }, { id: "3" }] });
    expect(first.view === "flat" && first.pagination).toMatchObject({
      total: 4,
      range: { start: 1, end: 2 },
      hasNext: true,
    });

    const second = queryDirectoryRows(rows, query({
      limit: 2,
      cursor: first.view === "flat" ? first.pagination.nextCursor : null,
    }));
    expect(second).toMatchObject({ view: "flat", members: [{ id: "4" }, { id: "2" }] });
    expect(second.view === "flat" && second.pagination).toMatchObject({
      range: { start: 3, end: 4 },
      hasNext: false,
      nextCursor: null,
    });
  });

  it("paginates each grouped member list and can target an expanded group", () => {
    const initial = queryDirectoryRows(rows, query({ view: "grouped", limit: 1 }));
    expect(initial.view).toBe("grouped");
    if (initial.view !== "grouped") throw new Error("Expected grouped directory response");
    expect(initial.total).toBe(4);
    expect(initial.groups).toEqual(expect.arrayContaining([
      expect.objectContaining({ team: "Engineering", members: [expect.objectContaining({ id: "3" })] }),
    ]));
    const engineering = initial.groups.find((group) => group.team === "Engineering");
    expect(engineering?.pagination).toMatchObject({ total: 2, hasNext: true });

    const next = queryDirectoryRows(rows, query({
      view: "grouped",
      group: "Engineering",
      limit: 1,
      cursor: engineering?.pagination.nextCursor ?? null,
    }));
    expect(next.view).toBe("grouped");
    if (next.view !== "grouped") throw new Error("Expected grouped directory response");
    expect(next.groups).toHaveLength(1);
    expect(next.groups[0]).toMatchObject({ team: "Engineering", members: [expect.objectContaining({ id: "2" })] });
  });

  it("rejects malformed and stale opaque cursors", () => {
    expect(() => queryDirectoryRows(rows, query({ cursor: "not-a-cursor" }))).toThrow(DirectoryCursorError);
    expect(() => queryDirectoryRows(rows, query({ cursor: "eyJuYW1lIjoiTWlzc2luZyIsImlkIjoiOTk5In0" }))).toThrow(DirectoryCursorError);
  });
});

describe("parseDirectoryQuery", () => {
  it("defaults page size to 24 and parses repeated facets", () => {
    expect(parseDirectoryQuery({ view: "grouped", team: ["Blue", "Engineering"], cohort: "2024" })).toEqual({
      view: "grouped",
      search: "",
      sort: "asc",
      teams: ["Blue", "Engineering"],
      programRoles: [],
      cohorts: [2024],
      limit: 24,
      cursor: null,
      group: null,
    });
  });

  it("rejects invalid limits, cursors, and grouped cursors without a group", () => {
    expect(parseDirectoryQuery({ limit: "25" })).toBeNull();
    expect(parseDirectoryQuery({ cursor: ["one", "two"] })).toBeNull();
    expect(parseDirectoryQuery({ view: "grouped", cursor: "opaque" })).toBeNull();
    expect(parseDirectoryQuery({ search: { nested: "value" } })).toBeNull();
  });
});
