// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { TutorReportWeekRow } from "@/lib/types/tutor-report-log"

const mocks = vi.hoisted(() => ({
  deleteTutorReportAction: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock("@/lib/server/actions", () => ({
  deleteTutorReportAction: mocks.deleteTutorReportAction,
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}))

vi.mock("@/components/data-display/campus-week-nav", () => ({
  CampusWeekUrlNav: () => <nav aria-label="Week navigation" />,
}))

import { TeamsTutoringClient } from "./teams-tutoring-client"

const rows: TutorReportWeekRow[] = [
  {
    id: 7,
    created_at: "2026-09-08T18:30:00.000Z",
    date: "2026-09-08",
    tutor_name: "Grace Hopper",
    scholar_uid: "900000001",
    start_time: "14:00",
    end_time: "15:00",
    courses: ["MATH 101", "CS 110"],
    scholar_name: "Ada Lovelace",
    day_of_week: "Tue",
  },
  {
    id: 8,
    created_at: "2026-09-09T18:30:00.000Z",
    date: "2026-09-09",
    tutor_name: "Alan Turing",
    scholar_uid: "n/a",
    start_time: "10:00",
    end_time: "11:00",
    courses: [],
    scholar_name: "EMPTY SESSION",
    day_of_week: "Wed",
  },
]

function renderClient(data: TutorReportWeekRow[] | null = rows) {
  return render(
    <TeamsTutoringClient
      basePath="/dashboard/teams/tutoring"
      weekNum={2}
      currentCampusWeek={4}
      rows={data}
      error={null}
    />
  )
}

function openRow(name: RegExp) {
  fireEvent.click(screen.getByRole("button", { name }))
}

describe("TeamsTutoringClient", () => {
  beforeEach(() => {
    mocks.deleteTutorReportAction.mockReset()
    mocks.refresh.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it("shows an empty state for a week with no forms", () => {
    renderClient([])
    expect(screen.getByText("No tutoring sessions this week.")).toBeTruthy()
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("lists tutor, day, time, scholar, then courses", () => {
    renderClient()
    const headers = screen.getAllByRole("columnheader").map((header) => header.textContent)
    expect(headers).toEqual(["Tutor", "Day", "Time", "Scholar", "Courses"])
    expect(screen.getByText("Ada Lovelace")).toBeTruthy()
    expect(screen.getByText("EMPTY SESSION")).toBeTruthy()
    expect(screen.getByText("MATH 101, CS 110")).toBeTruthy()
    expect(screen.getByText("14:00 – 15:00")).toBeTruthy()
  })

  it("opens session detail by pointer and by keyboard", async () => {
    renderClient()
    openRow(/Open session: Ada Lovelace/)
    const dialog = await screen.findByRole("dialog")
    expect(dialog.textContent).toContain("900000001")
    expect(dialog.textContent).toContain("Grace Hopper")
    expect(dialog.textContent).toContain("2026-09-08")

    for (const close of screen.getAllByRole("button", { name: "Close" })) {
      expect(close.closest("[role=dialog]")).toBe(dialog)
    }
    fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0])
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())

    fireEvent.keyDown(screen.getByRole("button", { name: /Open session: EMPTY SESSION/ }), { key: "Enter" })
    const emptyDialog = await screen.findByRole("dialog")
    expect(emptyDialog.textContent).toContain("EMPTY SESSION")
    expect(emptyDialog.textContent).toContain("n/a")
  })

  it("cancel on the confirm step does not delete", async () => {
    renderClient()
    openRow(/Open session: Ada Lovelace/)
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }))
    expect(screen.getByRole("dialog").textContent).toContain("Grace Hopper")
    expect(screen.getByRole("dialog").textContent).toContain("14:00 – 15:00")

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(mocks.deleteTutorReportAction).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Remove" })).toBeTruthy()
    expect(screen.getByRole("button", { name: /Open session: Ada Lovelace/, hidden: true })).toBeTruthy()
  })

  it("confirm calls the delete action and removes the row", async () => {
    mocks.deleteTutorReportAction.mockResolvedValue({ success: true })
    renderClient()
    openRow(/Open session: Ada Lovelace/)
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }))
    fireEvent.click(screen.getByRole("button", { name: "Remove session" }))

    await waitFor(() => expect(mocks.deleteTutorReportAction).toHaveBeenCalledWith(7))
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Open session: Ada Lovelace/, hidden: true })).toBeNull()
    )
    expect(screen.getByRole("button", { name: /Open session: EMPTY SESSION/ })).toBeTruthy()
    expect(mocks.refresh).toHaveBeenCalled()
  })

  it("keeps the row and shows the error when delete fails", async () => {
    mocks.deleteTutorReportAction.mockResolvedValue({ error: "Forbidden" })
    renderClient()
    openRow(/Open session: Ada Lovelace/)
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }))
    fireEvent.click(screen.getByRole("button", { name: "Remove session" }))

    expect(await screen.findByText("Forbidden")).toBeTruthy()
    expect(screen.getByRole("button", { name: /Open session: Ada Lovelace/, hidden: true })).toBeTruthy()
  })
})
