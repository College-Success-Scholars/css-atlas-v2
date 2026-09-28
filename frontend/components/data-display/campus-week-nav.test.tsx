// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { formatCampusWeekDateRange, formatCampusWeekOptionLabel } from "@/lib/format/campus-week"

import { CampusWeekNav } from "./campus-week-nav"

describe("CampusWeekNav", () => {
  afterEach(() => {
    cleanup()
  })

  it("shows the week number and the days that week represents", () => {
    render(
      <CampusWeekNav
        weeks={[3, 1, 2]}
        selectedWeek={2}
        currentCampusWeek={3}
        onWeekChange={() => {}}
      />,
    )

    const trigger = screen.getByRole("combobox", { name: formatCampusWeekOptionLabel(2, 3) })
    expect(trigger.textContent).toContain("Week 2")
    expect(trigger.textContent).toContain(formatCampusWeekDateRange(2))
    expect(trigger.textContent).not.toContain("(current)")
  })

  it("steps to the neighboring week number, ignoring list order", () => {
    const onWeekChange = vi.fn()
    render(
      <CampusWeekNav
        weeks={[4, 3, 2, 1]}
        selectedWeek={2}
        currentCampusWeek={4}
        onWeekChange={onWeekChange}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Previous week" }))
    fireEvent.click(screen.getByRole("button", { name: "Next week" }))

    expect(onWeekChange).toHaveBeenNthCalledWith(1, 1)
    expect(onWeekChange).toHaveBeenNthCalledWith(2, 3)
  })

  it("disables the previous control on the earliest week", () => {
    render(
      <CampusWeekNav
        weeks={[1, 2]}
        selectedWeek={1}
        currentCampusWeek={2}
        onWeekChange={() => {}}
      />,
    )

    expect((screen.getByRole("button", { name: "Previous week" }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole("button", { name: "Next week" }) as HTMLButtonElement).disabled).toBe(false)
  })
})
