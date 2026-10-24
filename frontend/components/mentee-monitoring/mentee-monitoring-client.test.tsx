// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  routerRefresh: vi.fn(),
  backendGet: vi.fn(),
  backendPut: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.routerPush, refresh: mocks.routerRefresh }),
}))

vi.mock("@/lib/client/api-client", () => ({
  backendGet: mocks.backendGet,
  backendPut: mocks.backendPut,
}))

// Behavior tests do not need Next's PostCSS pipeline or generated CSS-module names.
vi.mock("./mentee-review.module.css", () => ({
  default: { details: "details", requirements: "requirements", grades: "grades" },
}))

import { MenteeMonitoringClient } from "./mentee-monitoring-client"
import styles from "./mentee-review.module.css"
import type {
  HourWeekSummary,
  MenteeReview,
  MenteeReviewClientProps,
  SectionResult,
  WeekDescriptor,
  WeekReviewSummary,
} from "@/lib/types/mentee-review"

const AS_OF = "2026-09-10T19:12:00.000Z" // Thursday 3:12pm Eastern (EDT)
const UID = "123456789"
const OTHER_UID = "987654321"

function hours(kind: HourWeekSummary["kind"], overrides: Partial<HourWeekSummary> = {}): HourWeekSummary {
  return {
    kind,
    assignmentAvailable: true,
    loggedMinutes: 120,
    targetMinutes: 120,
    percent: 100,
    band: "green",
    displayHours: 2,
    overageMinutes: 0,
    pending: false,
    noShowCount: 0,
    hasActivity: true,
    shifts: [],
    offShiftLogs: [],
    ...overrides,
  }
}

function weekSummary(weekNumber: number, overrides: Partial<WeekReviewSummary> = {}): WeekReviewSummary {
  return {
    weekNumber,
    weekStart: "2026-09-07T04:00:00.000Z",
    weekEnd: "2026-09-13T04:00:00.000Z",
    phase: "current",
    hours: [hours("front_desk"), hours("study_session")],
    wahf: {
      status: "submitted",
      dueAt: "2026-09-11T03:59:59.999Z",
      submittedAt: "2026-09-10T14:00:00.000Z",
      onTime: true,
      submissionId: "w1",
    },
    tutoring: {
      status: "recorded",
      recordedAttendance: true,
      reports: [
        { reportId: "t1", courses: ["CMSC420", "MATH240"], date: "2026-09-08", startTime: "15:00", endTime: "16:00" },
      ],
    },
    ...overrides,
  }
}

function weekDescriptor(weekNumber: number, overrides: Partial<WeekDescriptor> = {}): WeekDescriptor {
  return {
    weekNumber,
    startDate: "2026-09-07T04:00:00.000Z",
    endDate: "2026-09-13T04:00:00.000Z",
    isBreak: false,
    isCurrent: false,
    isFuture: false,
    isSelectable: true,
    ...overrides,
  }
}

const WEEKS: WeekDescriptor[] = [
  weekDescriptor(1, { startDate: "2026-08-31T04:00:00.000Z", endDate: "2026-09-06T04:00:00.000Z" }),
  weekDescriptor(2, { isCurrent: true }),
  weekDescriptor(3, { isFuture: true, isSelectable: false }),
]

function ok<T>(data: T): SectionResult<T> {
  return { ok: true, data, loadedAt: AS_OF }
}

function makeReview(overrides: Partial<MenteeReview> = {}): MenteeReview {
  return {
    asOf: AS_OF,
    mentee: { uid: UID, fullName: "Test Mentee", email: "test@umd.edu" },
    calendar: {
      semesterId: "1",
      semesterStart: "2026-08-31T04:00:00.000Z",
      semesterEnd: "2026-12-12T04:00:00.000Z",
      currentWeek: 2,
      weeks: WEEKS,
      noActiveWeek: false,
    },
    currentWeek: 2,
    selectedWeek: 2,
    semesterGrid: ok([weekSummary(1, { phase: "past" }), weekSummary(2), weekSummary(3, { phase: "future" })]),
    selectedWeekReview: ok<WeekReviewSummary | null>(weekSummary(2)),
    latestGrades: ok({
      status: "grades" as const,
      submissionId: "w1",
      submittedAt: "2026-09-10T14:00:00.000Z",
      entries: [
        {
          course: "CMSC420",
          assessment: "Exam 1",
          rawGrade: "92%",
          percent: 92,
          band: "green" as const,
          comparison: null,
          firstGrade: true,
        },
      ],
    }),
    meetingPreference: ok({ weekday: 3, meetingTime: "15:00" }),
    ...overrides,
  }
}

function makeProps(overrides: Partial<MenteeReviewClientProps> = {}): MenteeReviewClientProps {
  return {
    mentees: [{ uid: UID, fullName: "Test Mentee", email: "test@umd.edu" }],
    review: makeReview(),
    selectedWeek: 2,
    ...overrides,
  }
}

describe("MenteeMonitoringClient", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // jsdom lacks the pointer APIs Radix Select relies on.
    Object.defineProperties(HTMLElement.prototype, {
      scrollIntoView: { value: vi.fn(), writable: true },
      hasPointerCapture: { value: vi.fn(() => false), writable: true },
      setPointerCapture: { value: vi.fn(), writable: true },
      releasePointerCapture: { value: vi.fn(), writable: true },
    })
  })

  afterEach(() => {
    cleanup()
  })

  it("renders the header, UID, current-week check-in bar, and hides the switcher for one mentee", () => {
    render(<MenteeMonitoringClient {...makeProps()} />)

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Test Mentee")
    expect(screen.getByText("UID 123456789")).toBeTruthy()
    expect(screen.getByText("Week 2 check-in form")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Fill MCF" })).toBeTruthy()
    expect(screen.queryByLabelText("Switch mentee")).toBeNull()
  })

  it("shows the mentee switcher when more than one mentee is assigned", () => {
    render(
      <MenteeMonitoringClient
        {...makeProps({
          mentees: [
            { uid: UID, fullName: "Test Mentee", email: "test@umd.edu" },
            { uid: OTHER_UID, fullName: "Other Mentee", email: null },
          ],
        })}
      />,
    )

    expect(screen.getByLabelText("Switch mentee")).toBeTruthy()
  })

  it("renders the four requirement cards in order beside an independently-loaded grades card", () => {
    render(<MenteeMonitoringClient {...makeProps()} />)

    const group = screen.getByRole("group", { name: "Weekly requirements" })
    const titles = within(group)
      .getAllByText(/^(Front desk|Study sessions|WAHF|Tutoring)$/)
      .map((node) => node.textContent)
    expect(titles).toEqual(["Front desk", "Study sessions", "WAHF", "Tutoring"])

    // Requirements and grades share the wrapping, top-aligned layout.
    expect(group.parentElement?.className).toContain(styles.details)
    expect(group.className).toContain(styles.requirements)
    expect(screen.getByRole("complementary", { name: "Recent grades" }).parentElement).toBe(group.parentElement)

    // Grades come from the latest submission, not the selected week's review.
    expect(screen.getByText("Recent grades")).toBeTruthy()
    expect(screen.getByText("CMSC420")).toBeTruthy()
  })

  it("selects a week column from any grid cell", () => {
    render(<MenteeMonitoringClient {...makeProps()} />)

    fireEvent.click(screen.getByRole("button", { name: /^Front desk: week 1,/ }))

    expect(mocks.routerPush).toHaveBeenCalledWith(`/dashboard/mentee?week=1&uid=${UID}`)
  })

  it("renders the directory detail view without the switcher or MCF bar", () => {
    render(
      <MenteeMonitoringClient
        {...makeProps({
          mentees: [
            { uid: UID, fullName: "Test Mentee", email: "test@umd.edu" },
            { uid: OTHER_UID, fullName: "Other Mentee", email: null },
          ],
          detailPath: `/dashboard/directory/${UID}`,
        })}
      />,
    )

    expect(screen.queryByLabelText("Switch mentee")).toBeNull()
    expect(screen.queryByText("Week 2 check-in form")).toBeNull()
    expect(screen.queryByRole("button", { name: "Fill MCF" })).toBeNull()
    expect(screen.getByText("UID 123456789")).toBeTruthy()
  })

  it("keeps week navigation on the directory detail path", () => {
    render(
      <MenteeMonitoringClient
        {...makeProps({ detailPath: `/dashboard/directory/${UID}` })}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: /^Front desk: week 1,/ }))

    expect(mocks.routerPush).toHaveBeenCalledWith(`/dashboard/directory/${UID}?week=1`)
  })

  it("highlights the whole week column on hover", () => {
    const { container } = render(<MenteeMonitoringClient {...makeProps()} />)
    const cells = Array.from(container.querySelectorAll('td[data-week="1"]'))
    expect(cells).toHaveLength(4)

    fireEvent.mouseEnter(cells[0]!)
    cells.forEach((cell) => expect(cell.className).toContain("bg-muted/40"))

    fireEvent.mouseLeave(cells[0]!)
    cells.forEach((cell) => expect(cell.className).not.toContain("bg-muted/40"))
  })

  it("marks the current week column when another week is selected", () => {
    const review = makeReview({
      selectedWeek: 1,
      selectedWeekReview: ok<WeekReviewSummary | null>(weekSummary(1, { phase: "past" })),
    })
    const { container } = render(
      <MenteeMonitoringClient {...makeProps({ review, selectedWeek: 1 })} />,
    )

    const currentCells = Array.from(container.querySelectorAll('td[data-week="2"]'))
    expect(currentCells).toHaveLength(4)
    currentCells.forEach((cell) => expect(cell.className).toContain("bg-info-muted/50"))
  })

  it("color codes hour cells from the same band as the requirement cards", () => {
    render(<MenteeMonitoringClient {...makeProps()} />)

    const frontDeskCell = screen.getByRole("button", { name: /^Front desk: week 1,/ })
    expect(frontDeskCell.className).toContain("bg-success-muted")
    expect(frontDeskCell.className).toContain("text-success-muted-foreground")
  })

  it("colors orange hour cells for weeks between 60% and 90%", () => {
    const review = makeReview({
      semesterGrid: ok([
        weekSummary(1, {
          phase: "past",
          hours: [
            hours("front_desk", { percent: 75, band: "orange" }),
            hours("study_session"),
          ],
        }),
        weekSummary(2),
        weekSummary(3, { phase: "future" }),
      ]),
    })
    render(<MenteeMonitoringClient {...makeProps({ review })} />)

    const frontDeskCell = screen.getByRole("button", { name: /^Front desk: week 1,/ })
    expect(frontDeskCell.className).toContain("bg-warning-muted")
    expect(frontDeskCell.className).toContain("text-warning-muted-foreground")
  })

  it("keeps future week cells non-actionable", () => {
    render(<MenteeMonitoringClient {...makeProps()} />)

    const futureCell = screen.getByRole("button", { name: /^Front desk: week 3, not yet started/ })
    const futureHeader = screen.getByRole("button", { name: "Week 3, Sep 7–Sep 13" })
    expect((futureCell as HTMLButtonElement).disabled).toBe(true)
    expect((futureHeader as HTMLButtonElement).disabled).toBe(true)
  })

  it("retains the selected week when switching mentees", () => {
    const review = makeReview({
      selectedWeek: 1,
      selectedWeekReview: ok<WeekReviewSummary | null>(weekSummary(1, { phase: "past" })),
    })
    render(
      <MenteeMonitoringClient
        {...makeProps({
          review,
          selectedWeek: 1,
          mentees: [
            { uid: UID, fullName: "Test Mentee", email: "test@umd.edu" },
            { uid: OTHER_UID, fullName: "Other Mentee", email: null },
          ],
        })}
      />,
    )

    fireEvent.click(screen.getByLabelText("Switch mentee"))
    fireEvent.click(screen.getByRole("option", { name: "Other Mentee" }))

    expect(mocks.routerPush).toHaveBeenCalledWith(`/dashboard/mentee?week=1&uid=${OTHER_UID}`)
  })

  it("shows a past week's title with a Back to this week action only", () => {
    const review = makeReview({
      selectedWeek: 1,
      selectedWeekReview: ok<WeekReviewSummary | null>(weekSummary(1, { phase: "past" })),
    })
    render(<MenteeMonitoringClient {...makeProps({ review, selectedWeek: 1 })} />)

    expect(screen.getByText("Week 1 · Aug 31 – Sep 6")).toBeTruthy()
    expect(screen.queryByText(/In progress · as of/)).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Back to this week" }))
    expect(mocks.routerPush).toHaveBeenCalledWith(`/dashboard/mentee?week=2&uid=${UID}`)
  })

  it("shows the current week as in progress with the data-load time", () => {
    render(<MenteeMonitoringClient {...makeProps()} />)

    expect(screen.getByText("In progress · as of Thursday 3:12pm")).toBeTruthy()
  })

  it("uses compact shadcn cards without stacking default card and content padding", () => {
    const { container } = render(<MenteeMonitoringClient {...makeProps()} />)
    const cards = container.querySelectorAll('[data-slot="card"]')
    expect(cards.length).toBeGreaterThan(0)
    cards.forEach((card) => {
      expect(card.className).toContain("py-0")
      expect(card.className).toContain("shadow-none")
    })
  })

  it("places the selected-week heading before both detail columns and uses stacked grade entries", () => {
    render(<MenteeMonitoringClient {...makeProps()} />)
    const heading = screen.getByRole("heading", { name: "Week 2 · Sep 7 – Sep 13" })
    const grades = screen.getByRole("complementary", { name: "Recent grades" })
    expect(heading.compareDocumentPosition(grades) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const list = within(grades).getByRole("list")
    const entry = within(list).getByRole("listitem")
    expect(within(entry).getByText("CMSC420")).toBeTruthy()
    expect(within(entry).getByText("Exam 1")).toBeTruthy()
    expect(within(entry).getByText("92%").getAttribute("data-slot")).toBe("badge")
    expect(within(entry).getByText("First grade logged")).toBeTruthy()
  })

  it("keeps a failed section local: Retry stays in that section while others render", () => {
    const review = makeReview({
      latestGrades: {
        ok: false,
        error: { code: "wahf_read_failed", message: "Grades unavailable", retriable: true },
      },
    })
    render(<MenteeMonitoringClient {...makeProps({ review })} />)

    expect(screen.getByRole("alert", { name: "Recent grades failed to load" })).toBeTruthy()
    expect(screen.getAllByText("Front desk").length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(mocks.routerRefresh).toHaveBeenCalled()
  })

  it("renders a neutral no-active-week state and disables the check-in form", () => {
    const review = makeReview({
      calendar: {
        semesterId: null,
        semesterStart: null,
        semesterEnd: null,
        currentWeek: null,
        weeks: [],
        noActiveWeek: true,
      },
      currentWeek: null,
      selectedWeek: null,
      semesterGrid: ok([]),
    })
    render(<MenteeMonitoringClient {...makeProps({ review, selectedWeek: null })} />)

    expect(screen.getByText("No active semester week")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Fill MCF" })).toBeNull()
  })

  it("shows an empty state with no assigned mentees", () => {
    render(<MenteeMonitoringClient mentees={[]} review={null} selectedWeek={null} />)

    expect(screen.getByText("No mentees yet")).toBeTruthy()
  })
})
