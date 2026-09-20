import { describe, expect, it } from "vitest"

import { filterRoomScholarsByName } from "./filter-room-scholars"

const scholars = [
  { scholarId: "uid-alex", scholarName: "Alex Rodriguez" },
  { scholarId: "uid-sarah", scholarName: "Sarah Johnson" },
  { scholarId: "uid-unknown", scholarName: null },
]

describe("filterRoomScholarsByName", () => {
  it("returns all rows when the query is empty or whitespace", () => {
    expect(filterRoomScholarsByName(scholars, "")).toEqual(scholars)
    expect(filterRoomScholarsByName(scholars, "   ")).toEqual(scholars)
  })

  it("matches scholar names case-insensitively", () => {
    expect(filterRoomScholarsByName(scholars, "alex")).toEqual([scholars[0]])
    expect(filterRoomScholarsByName(scholars, "JOHNSON")).toEqual([scholars[1]])
  })

  it("does not match scholar ids", () => {
    expect(filterRoomScholarsByName(scholars, "uid-alex")).toEqual([])
  })

  it("returns no rows when nothing matches", () => {
    expect(filterRoomScholarsByName(scholars, "zzz")).toEqual([])
  })
})
