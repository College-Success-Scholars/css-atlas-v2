// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { Suspense, useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"
import type { MenteeMonitoringClientProps, WahfRow } from "@/lib/types/supabase"
import { campusWeekToDateRange } from "@/lib/format/time"
import { MenteeMonitoringClient } from "./mentee-monitoring-client"

const { routerPush } = vi.hoisted(() => ({ routerPush: vi.fn() }))
const originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView")
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: routerPush }) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const props = {
  mentees: [{ scholar_uid: "123456789", first_name: "Test", last_name: "Mentee" }],
  attendance: { rows: [] },
  wahf: [],
  tutoring: [],
  currentCampusWeek: null,
  selectedWeek: null,
  selectedUid: "123456789",
} as MenteeMonitoringClientProps

function submission(week: number, overrides: Partial<WahfRow> = {}): WahfRow {
  return {
    id: `week-${week}`,
    created_at: campusWeekToDateRange(week)!.startDate.toISOString(),
    scholar_uid: "123456789",
    scholar_name: "Test Mentee",
    team_leader_contact: "Yes",
    tl_meeting_in_person: "Yes",
    course_changes: "No",
    assignment_grades: { MATH: { Exam: "80%" } },
    missed_classes: "No",
    missed_assignments: "No",
    submitted_by_email: null,
    course_change_details: "Selected-week details",
    ...overrides,
  }
}

describe("MenteeMonitoringClient", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    routerPush.mockReset()
    vi.unstubAllGlobals()
    if (originalScrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", originalScrollIntoView)
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView")
    }
  })

  it("copies only the currently selected UID and confirms success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", { clipboard: { writeText } })
    const { rerender } = render(<MenteeMonitoringClient {...props} />)

    fireEvent.click(screen.getByRole("button", { name: "Copy mentee UID 123456789" }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Mentee UID copied"))
    expect(writeText).toHaveBeenCalledWith("123456789")

    rerender(<MenteeMonitoringClient {...props} selectedUid="987654321" />)
    fireEvent.click(screen.getByRole("button", { name: "Copy mentee UID 987654321" }))
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith("987654321"))
  })

  it("hides the mentee selector for a single mentee but keeps week navigation", () => {
    const { rerender } = render(<MenteeMonitoringClient {...props} currentCampusWeek={3} selectedWeek={2} />)
    expect(screen.queryByRole("combobox", { name: "Select mentee" })).toBeNull()
    expect(screen.getByRole("button", { name: "Previous week" })).toBeTruthy()

    rerender(
      <MenteeMonitoringClient {...props} mentees={[
        ...props.mentees,
        { ...props.mentees[0], scholar_uid: "987654321", first_name: "Other", last_name: "Mentee" },
      ]} />,
    )
    expect(screen.getByRole("combobox", { name: "Select mentee" })).toBeTruthy()
  })

  it("immediately shows skeletons while week navigation suspends, then renders the new details", async () => {
    let finishNavigation!: () => void
    let ready = false
    const dataReady = new Promise<void>((resolve) => { finishNavigation = resolve }).then(() => { ready = true })
    const initialProps = { ...props, currentCampusWeek: 3, selectedWeek: 2, wahf: [submission(2)] }

    function NavigationGate({ navigating }: { navigating: boolean }) {
      if (navigating && !ready) throw dataReady
      return null
    }

    function RoutedPage() {
      const [week, setWeek] = useState(2)
      routerPush.mockImplementation((href: string) => {
        setWeek(Number(new URL(href, "http://localhost").searchParams.get("week")))
      })
      return (
        <Suspense fallback={<p>Route loading</p>}>
          <MenteeMonitoringClient {...initialProps} selectedWeek={week} />
          <NavigationGate navigating={week !== 2} />
        </Suspense>
      )
    }

    render(<RoutedPage />)
    expect(screen.getByRole("button", { name: "View details" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Previous week" }))
    expect(routerPush).toHaveBeenCalledWith("/dashboard/mentee?week=1&uid=123456789")
    expect(screen.getByRole("status", { name: "Loading mentee details" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "View details" })).toBeNull()
    expect((screen.getByRole("button", { name: "Next week" }) as HTMLButtonElement).disabled).toBe(true)

    await act(async () => { finishNavigation(); await dataReady })
    await waitFor(() => expect(screen.queryByRole("status", { name: "Loading mentee details" })).toBeNull())
    expect(screen.getByText("Study session hours")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "View details" })).toBeNull()
    expect((screen.getByRole("button", { name: "Next week" }) as HTMLButtonElement).disabled).toBe(false)
  })

  it("shows skeletons during mentee navigation and replaces the old scholar’s details", async () => {
    // jsdom has no scrolling implementation; Radix Select scrolls its focused option.
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() })
    let finishNavigation!: () => void
    let ready = false
    const dataReady = new Promise<void>((resolve) => { finishNavigation = resolve }).then(() => { ready = true })
    const initialProps = {
      ...props,
      currentCampusWeek: 3,
      selectedWeek: 2,
      mentees: [
        ...props.mentees,
        { ...props.mentees[0], scholar_uid: "987654321", first_name: "Other", last_name: "Mentee" },
      ],
      wahf: [submission(2)],
    }

    function NavigationGate({ navigating }: { navigating: boolean }) {
      if (navigating && !ready) throw dataReady
      return null
    }

    function RoutedPage() {
      const [uid, setUid] = useState("123456789")
      routerPush.mockImplementation((href: string) => {
        setUid(new URL(href, "http://localhost").searchParams.get("uid")!)
      })
      return (
        <Suspense fallback={<p>Route loading</p>}>
          <MenteeMonitoringClient {...initialProps} selectedUid={uid} />
          <NavigationGate navigating={uid !== "123456789"} />
        </Suspense>
      )
    }

    render(<RoutedPage />)
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Select mentee" }), { key: "Enter" })
    fireEvent.click(await screen.findByRole("option", { name: "Other Mentee" }))
    expect(routerPush).toHaveBeenCalledWith("/dashboard/mentee?week=2&uid=987654321")
    expect(screen.getByRole("status", { name: "Loading mentee details" })).toBeTruthy()
    expect(screen.queryByRole("table")).toBeNull()
    expect((screen.getByRole("combobox", { name: "Select mentee" }) as HTMLButtonElement).disabled).toBe(true)

    await act(async () => { finishNavigation(); await dataReady })
    await waitFor(() => expect(screen.queryByRole("status", { name: "Loading mentee details" })).toBeNull())
    expect(screen.getByRole("heading", { name: "Other Mentee" })).toBeTruthy()
    expect(screen.queryByRole("table")).toBeNull()
    expect(screen.getByText("No grades reported in this scholar’s WAHF submissions yet.")).toBeTruthy()
  })

  it("reports clipboard failures without claiming success", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("Clipboard denied")) },
    })
    render(<MenteeMonitoringClient {...props} />)

    fireEvent.click(screen.getByRole("button", { name: "Copy mentee UID 123456789" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(toast.success).not.toHaveBeenCalled()
  })

  it("opens the selected-week submission while showing latest reported grades on the page", async () => {
    const activeProps = {
      ...props,
      currentCampusWeek: 4,
      selectedWeek: 2,
      wahf: [
        submission(2),
        submission(3, { assignment_grades: { ENGL: { Essay: "A-" } } }),
        submission(4, { assignment_grades: null }),
        submission(4, { scholar_uid: "other", assignment_grades: { SECRET: { Exam: "99%" } } }),
      ],
    }
    const { rerender } = render(<MenteeMonitoringClient {...activeProps} />)
    const table = screen.getByRole("table")
    expect(table.textContent).toContain("ENGL")
    expect(table.textContent).toContain("A-")
    expect(table.textContent).not.toContain("MATH")
    expect(table.textContent).not.toContain("SECRET")

    fireEvent.click(screen.getByRole("button", { name: "View details" }))
    const dialog = await screen.findByRole("dialog")
    expect(dialog.textContent).toContain("WAHF Submission")
    expect(dialog.textContent).toContain("Selected-week details")
    expect(dialog.textContent).toContain("MATH: Exam(80%)")
    expect(dialog.textContent).not.toContain("ENGL")
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())

    rerender(<MenteeMonitoringClient {...activeProps} selectedWeek={1} />)
    expect(screen.queryByRole("button", { name: "View details" })).toBeNull()
    expect(screen.getByRole("table").textContent).toContain("A-")

    rerender(<MenteeMonitoringClient {...activeProps} selectedUid="no-grades" />)
    expect(screen.queryByRole("table")).toBeNull()
    expect(screen.getByText("No grades reported in this scholar’s WAHF submissions yet.")).toBeTruthy()
  })

  it("closes the details dialog when switching mentees", async () => {
    const activeProps = { ...props, currentCampusWeek: 2, selectedWeek: 2, wahf: [submission(2)] }
    const { rerender } = render(<MenteeMonitoringClient {...activeProps} />)
    fireEvent.click(screen.getByRole("button", { name: "View details" }))
    await screen.findByRole("dialog")
    rerender(<MenteeMonitoringClient {...activeProps} selectedUid="another-mentee" />)
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })
})
