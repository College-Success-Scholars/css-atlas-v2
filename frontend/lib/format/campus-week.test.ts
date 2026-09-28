import { describe, expect, it } from "vitest"

import {
  adjacentCampusWeeks,
  campusWeekNumbers,
  formatCampusWeekDateRange,
  formatCampusWeekOptionLabel,
  parseWeekParam,
} from "./campus-week"

describe("parseWeekParam", () => {
  it("rejects empty and non-positive values", () => {
    expect(parseWeekParam(undefined)).toBeNull()
    expect(parseWeekParam("")).toBeNull()
    expect(parseWeekParam("abc")).toBeNull()
    expect(parseWeekParam("0")).toBeNull()
  })

  it("parses a positive week", () => {
    expect(parseWeekParam("5")).toBe(5)
  })
})

describe("formatCampusWeekOptionLabel", () => {
  it("joins the week number with the days that week represents", () => {
    const dates = formatCampusWeekDateRange(1)
    expect(dates.startsWith("Week ")).toBe(false)
    expect(formatCampusWeekOptionLabel(1, 3)).toBe(`Week 1 · ${dates}`)
  })

  it("marks the current week", () => {
    const dates = formatCampusWeekDateRange(2)
    expect(formatCampusWeekOptionLabel(2, 2)).toBe(`Week 2 (current) · ${dates}`)
  })
})

describe("campusWeekNumbers", () => {
  it("is empty before the collection year starts", () => {
    expect(campusWeekNumbers(null)).toEqual([])
    expect(campusWeekNumbers(0)).toEqual([])
  })

  it("lists weeks 1 through the max, ascending", () => {
    expect(campusWeekNumbers(3)).toEqual([1, 2, 3])
  })
})

describe("adjacentCampusWeeks", () => {
  it("steps by week number when the list is newest-first", () => {
    expect(adjacentCampusWeeks([4, 3, 2, 1], 2)).toEqual({ prevWeek: 1, nextWeek: 3 })
  })

  it("has no neighbor past either end", () => {
    expect(adjacentCampusWeeks([1, 2], 1).prevWeek).toBeNull()
    expect(adjacentCampusWeeks([1, 2], 2).nextWeek).toBeNull()
  })
})
