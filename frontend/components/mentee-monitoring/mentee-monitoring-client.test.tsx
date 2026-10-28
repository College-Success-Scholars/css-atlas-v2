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

import { applyWeekTiers } from "@/lib/tiers"
import { MenteeMonitoringClient } from "./mentee-monitoring-client"
import styles from "./mentee-review.module.css"
import { TIER_UI } from "./tier-badge"
import tierStyles from "./tier-styles.module.css"

vi.mock("./tier-styles.module.css", () => ({ default: {
  palette: "tier-palette", rare: "tier-rare", epic: "tier-epic", legendary: "tier-legendary",
  pill: "tier-pill", cell: "tier-cell", card: "tier-card", text: "tier-text",
  bar: "tier-bar", sheen: "tier-sheen", legendaryHours: "tier-legendary-hours",
} }))
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
    tier: null,
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
    mentee: { uid: UID, fullName: "Test Mentee", email: "test@umd.edu", cohort: 2026 },
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

    // Recent grades are independent of the selected week's review.
    expect(screen.getByText("Recent grades")).toBeTruthy()
    expect(screen.getByText("CMSC420")).toBeTruthy()
  })

  it("selects a week column from any grid cell", () => {
    render(<MenteeMonitoringClient {...makeProps()} />)

    fireEvent.click(screen.getByRole("button", { name: /^Front desk: week 1,/ }))

    expect(mocks.routerPush).toHaveBeenCalledWith(`/dashboard/mentee?week=1&uid=${UID}`)
    expect(mocks.routerPush).toHaveBeenCalledTimes(1)
  })

  it("exposes every available grid cell as a keyboard-operable, labelled button", () => {
    render(<MenteeMonitoringClient {...makeProps()} />)

    const cell = screen.getByRole("button", { name: /^Front desk: week 1,/ }) as HTMLButtonElement
    expect(cell.tabIndex).toBe(0)
    expect(cell.getAttribute("title")).toContain("Front desk: week 1")

    cell.focus()
    expect(document.activeElement).toBe(cell)
    fireEvent.click(cell)
    expect(mocks.routerPush).toHaveBeenCalledWith(`/dashboard/mentee?week=1&uid=${UID}`)
  })

  it("keeps Fill MCF as an outline action", () => {
    render(<MenteeMonitoringClient {...makeProps()} />)

    const fill = screen.getByRole("button", { name: "Fill MCF" })
    expect(fill.className.split(/\s+/)).not.toContain("bg-primary")
  })

  it("pairs status colors with words for WAHF and tutoring", () => {
    render(<MenteeMonitoringClient {...makeProps()} />)

    const requirements = within(screen.getByRole("group", { name: "Weekly requirements" }))
    expect(requirements.getByText("Submitted")).toBeTruthy()
    expect(requirements.getByText("Attended")).toBeTruthy()
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

  it("keeps the cohort query when navigating weeks on the directory path", () => {
    render(
      <MenteeMonitoringClient
        {...makeProps({ detailPath: `/dashboard/directory/${UID}?cohort=2025` })}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: /^Front desk: week 1,/ }))

    expect(mocks.routerPush).toHaveBeenCalledWith(
      `/dashboard/directory/${UID}?cohort=2025&week=1`,
    )
  })

  it("highlights the whole week column on hover", () => {
    const { container } = render(<MenteeMonitoringClient {...makeProps()} />)
    const cells = Array.from(container.querySelectorAll('td[data-week="1"]'))
    expect(cells).toHaveLength(4)

    fireEvent.mouseEnter(cells[0]!)
    cells.forEach((cell) => expect(cell.className.split(/\s+/)).toContain("bg-muted"))
    const header = screen.getByRole("button", { name: "Week 1, Aug 31–Sep 6" }).closest("th")!
    expect(header.className.split(/\s+/)).toContain("bg-muted")

    fireEvent.mouseLeave(cells[0]!)
    cells.forEach((cell) => expect(cell.className.split(/\s+/)).not.toContain("bg-muted"))
  })

  it("keeps the visual gaps inside clickable column padding", () => {
    const { container } = render(<MenteeMonitoringClient {...makeProps()} />)
    const table = screen.getByRole("table")
    expect(table.className).toContain("border-spacing-0")

    const cells = Array.from(container.querySelectorAll('td[data-week="1"]'))
    for (const cell of cells) {
      expect(cell.className).toContain("py-[3px]")
      fireEvent.click(cell)
    }
    fireEvent.click(container.querySelector('th[data-week="1"]')!)
    expect(mocks.routerPush).toHaveBeenCalledTimes(5)
    expect(mocks.routerPush).toHaveBeenLastCalledWith(`/dashboard/mentee?week=1&uid=${UID}`)
  })

  it("highlights the full column when hovering its header or focusing a cell", () => {
    const { container } = render(<MenteeMonitoringClient {...makeProps()} />)
    const header = container.querySelector('th[data-week="1"]')!
    const cells = Array.from(container.querySelectorAll('td[data-week="1"]'))
    fireEvent.mouseEnter(header)
    cells.forEach((cell) => expect(cell.className.split(/\s+/)).toContain("bg-muted"))
    fireEvent.mouseLeave(header)
    fireEvent.focus(cells[2]!.querySelector("button")!)
    cells.forEach((cell) => expect(cell.className.split(/\s+/)).toContain("bg-muted"))
    fireEvent.blur(cells[2]!.querySelector("button")!)
    cells.forEach((cell) => expect(cell.className.split(/\s+/)).not.toContain("bg-muted"))
  })

  it("also emphasizes the selected column on hover", () => {
    const { container } = render(<MenteeMonitoringClient {...makeProps()} />)
    const cells = Array.from(container.querySelectorAll('td[data-week="2"]'))
    fireEvent.mouseEnter(cells[0]!)
    cells.forEach((cell) => expect(cell.className).toContain("bg-primary/[0.12]"))
    fireEvent.mouseLeave(cells[0]!)
    cells.forEach((cell) => expect(cell.className).toContain("bg-primary/[0.07]"))
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
    expect(frontDeskCell.className).toContain("bg-success/20")
    expect(frontDeskCell.className).toContain("text-success-muted-foreground")
  })

  it("colors the current week by band instead of leaving pending cells blank", () => {
    const review = makeReview({
      semesterGrid: ok([
        weekSummary(1, { phase: "past" }),
        weekSummary(2, {
          hours: [
            hours("front_desk", { percent: 70, band: "orange", pending: true }),
            hours("study_session", { percent: 70, band: "orange", pending: true }),
          ],
        }),
        weekSummary(3, { phase: "future" }),
      ]),
    })
    render(<MenteeMonitoringClient {...makeProps({ review })} />)

    const frontDeskCell = screen.getByRole("button", { name: /^Front desk: week 2,/ })
    expect(frontDeskCell.className).toContain("bg-warning/25")
    expect(frontDeskCell.className).not.toContain("bg-card")
  })

  it("applies each hourly requirement's tier to its grid cell and detail card", () => {
    const tieredHours = [
      hours("front_desk", { loggedMinutes: 330, targetMinutes: 300, percent: 110 }),
      hours("study_session", { loggedMinutes: 330, targetMinutes: 300, percent: 110 }),
    ]
    const review = applyWeekTiers(
      makeReview({
        semesterGrid: ok([
          weekSummary(1, { phase: "past" }),
          weekSummary(2, { hours: tieredHours }),
          weekSummary(3, { phase: "future" }),
        ]),
        selectedWeekReview: ok<WeekReviewSummary | null>(weekSummary(2, { hours: tieredHours })),
      }),
    )
    render(<MenteeMonitoringClient {...makeProps({ review })} />)

    const frontDesk = screen.getByRole("button", { name: /^Front desk: week 2,.*Rare tier/ })
    const study = screen.getByRole("button", { name: /^Study: week 2,.*Rare tier/ })
    expect(frontDesk.getAttribute("data-tier")).toBe("rare")
    expect(study.getAttribute("data-tier")).toBe("rare")
    expect(frontDesk.className).toContain(TIER_UI.rare.cell)
    expect(study.className).toContain(TIER_UI.rare.cell)

    const wahf = screen.getByRole("button", { name: /^WAHF: week 2,/ })
    expect(wahf.getAttribute("data-tier")).toBeNull()
    expect((wahf as HTMLElement).style.backgroundColor).toBe("var(--success-muted)")

    const requirements = screen.getByRole("group", { name: "Weekly requirements" })
    expect(within(requirements).getAllByText("Rare")).toHaveLength(2)
  })

  it.each([
    {
      name: "legendary study hours without a front-desk tier",
      frontDeskMinutes: 182.83,
      frontDeskTarget: 180,
      studyMinutes: 502.06,
      frontDeskTier: null,
      studyTier: "legendary",
      legendTiers: ["rare", "epic", "legendary"],
    },
    {
      name: "rare front-desk hours and epic study hours",
      frontDeskMinutes: 330,
      frontDeskTarget: 300,
      studyMinutes: 360,
      frontDeskTier: "rare",
      studyTier: "epic",
      legendTiers: ["rare", "epic"],
    },
  ] as const)("renders independent tiers for $name", ({
    frontDeskMinutes, frontDeskTarget, studyMinutes, frontDeskTier, studyTier, legendTiers,
  }) => {
    const requirementHours = [
      hours("front_desk", {
        loggedMinutes: frontDeskMinutes,
        targetMinutes: frontDeskTarget,
        percent: frontDeskMinutes / frontDeskTarget * 100,
      }),
      hours("study_session", {
        loggedMinutes: studyMinutes,
        targetMinutes: 300,
        percent: studyMinutes / 300 * 100,
      }),
    ]
    const review = applyWeekTiers(makeReview({
      mentee: { uid: UID, fullName: "Anonymous Scholar", email: "scholar@example.test", cohort: 2026 },
      semesterGrid: ok([
        weekSummary(1, { phase: "past" }),
        weekSummary(2, { hours: requirementHours }),
        weekSummary(3, { phase: "future" }),
      ]),
      selectedWeekReview: ok(weekSummary(2, { hours: requirementHours })),
    }))
    render(<MenteeMonitoringClient {...makeProps({ review })} />)

    const frontDesk = screen.getByRole("button", { name: /^Front desk: week 2,/ })
    const study = screen.getByRole("button", { name: /^Study: week 2,/ })
    expect(frontDesk.getAttribute("data-tier")).toBe(frontDeskTier)
    expect(study.getAttribute("data-tier")).toBe(studyTier)
    expect(study.getAttribute("aria-label")).toContain(`${TIER_UI[studyTier].label} tier`)
    expect(study.className).toContain(TIER_UI[studyTier].cell)
    if (frontDeskTier) {
      expect(frontDesk.getAttribute("aria-label")).toContain(`${TIER_UI[frontDeskTier].label} tier`)
      expect(frontDesk.className).toContain(TIER_UI[frontDeskTier].cell)
    } else {
      expect(frontDesk.getAttribute("aria-label")).not.toContain("tier")
      expect(frontDesk.className).not.toContain(tierStyles.cell)
    }

    const requirements = within(screen.getByRole("group", { name: "Weekly requirements" }))
    const frontDeskCard = requirements.getByText("Front desk").closest('[data-slot="card"]')!
    const studyCard = requirements.getByText("Study sessions").closest('[data-slot="card"]')!
    expect(frontDeskCard.getAttribute("data-tier")).toBe(frontDeskTier)
    expect(studyCard.getAttribute("data-tier")).toBe(studyTier)
    expect(within(studyCard as HTMLElement).getByText(TIER_UI[studyTier].label)).toBeTruthy()
    if (frontDeskTier) {
      expect(within(frontDeskCard as HTMLElement).getByText(TIER_UI[frontDeskTier].label)).toBeTruthy()
    } else {
      expect(frontDeskCard.querySelector("[data-tier]")).toBeNull()
    }

    const legend = screen.getByTestId("semester-legend")
    expect(Array.from(legend.querySelectorAll("[data-tier]"), (tag) => tag.getAttribute("data-tier"))).toEqual(legendTiers)
    const heading = screen.getByRole("heading", { name: "Week 2 · Sep 7 – Sep 13" })
    expect(heading.parentElement!.querySelector("[data-tier]")).toBeNull()
    expect(screen.getByText("In progress · as of Thursday 3:12pm")).toBeTruthy()
    for (const title of ["WAHF", "Tutoring"]) {
      const card = requirements.getByText(title).closest('[data-slot="card"]')!
      expect(card.getAttribute("data-tier")).toBeNull()
      expect(card.querySelector("[data-tier]")).toBeNull()
    }
  })

  it("keeps the blue current-week ring outside a legendary tier cell", () => {
    const legendaryHours = [
      hours("front_desk", { loggedMinutes: 390, targetMinutes: 300, percent: 130 }),
      hours("study_session", { loggedMinutes: 390, targetMinutes: 300, percent: 130 }),
    ]
    const review = applyWeekTiers(
      makeReview({
        selectedWeek: 1,
        semesterGrid: ok([
          weekSummary(1, { phase: "past" }),
          weekSummary(2, { hours: legendaryHours }),
          weekSummary(3, { phase: "future" }),
        ]),
        selectedWeekReview: ok<WeekReviewSummary | null>(weekSummary(1, { phase: "past" })),
      }),
    )
    render(
      <MenteeMonitoringClient {...makeProps({ review, selectedWeek: 1 })} />,
    )

    const frontDesk = screen.getByRole("button", { name: /^Front desk: week 2,.*Legendary tier/ })
    expect(frontDesk.getAttribute("data-tier")).toBe("legendary")
    expect(frontDesk.className).toContain("ring-2")
    expect(frontDesk.className).toContain("ring-info")
    expect(frontDesk.className).toContain("ring-offset-2")
    expect(frontDesk.className).toContain(tierStyles.sheen)
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
    expect(frontDeskCell.className).toContain("bg-warning/25")
    expect(frontDeskCell.className).toContain("text-warning-muted-foreground")
    expect((frontDeskCell as HTMLElement).style.backgroundColor).toBe("var(--warning-muted)")
  })

  it("hides unachieved tier tags and the no-show legend and uses a short low-completion label", () => {
    render(<MenteeMonitoringClient {...makeProps()} />)

    const legend = screen.getByTestId("semester-legend")
    expect(legend.querySelector("[data-tier]")).toBeNull()
    expect(within(legend).queryByText(/no-show/)).toBeNull()
    expect(within(legend).getByText("<60% / missed")).toBeTruthy()
  })

  it.each([
    { label: "90%+", band: "green", percent: 95, backgroundClass: "bg-success/20" },
    { label: "60–89%", band: "orange", percent: 75, backgroundClass: "bg-warning/25" },
    { label: "<60% / missed", band: "red", percent: 40, backgroundClass: "bg-destructive/20" },
  ] as const)("matches the $band completion legend swatch to its grid cells", ({ label, band, percent, backgroundClass }) => {
    const review = makeReview({
      semesterGrid: ok([
        weekSummary(1, { phase: "past", hours: [hours("front_desk", { percent, band })] }),
        weekSummary(2),
        weekSummary(3, { phase: "future" }),
      ]),
    })
    render(<MenteeMonitoringClient {...makeProps({ review })} />)

    const legend = within(screen.getByTestId("semester-legend"))
    const swatch = legend.getByText(label).querySelector("span")!
    const cell = screen.getByRole("button", { name: /^Front desk: week 1,/ })
    expect(swatch.className).toContain(backgroundClass)
    expect(cell.className).toContain(backgroundClass)
    expect(swatch.style.backgroundColor).toBe(cell.style.backgroundColor)
  })

  it.each([
    { achievedTier: "rare", expectedTiers: ["rare"] },
    { achievedTier: "epic", expectedTiers: ["rare", "epic"] },
    { achievedTier: "legendary", expectedTiers: ["rare", "epic", "legendary"] },
  ] as const)("shows every legend tier through $achievedTier", ({ achievedTier, expectedTiers }) => {
    const review = makeReview({ semesterGrid: ok([
      weekSummary(1, { phase: "past", hours: [hours("front_desk"), hours("study_session", { tier: achievedTier })] }),
      weekSummary(2),
      weekSummary(3, { phase: "future" }),
    ]) })
    render(<MenteeMonitoringClient {...makeProps({ review })} />)

    const legend = screen.getByTestId("semester-legend")
    expect(Array.from(legend.querySelectorAll("[data-tier]"), (tag) => tag.getAttribute("data-tier"))).toEqual(expectedTiers)
    for (const tier of ["rare", "epic", "legendary"] as const) {
      const tag = legend.querySelector(`[data-tier="${tier}"]`)
      if (!(expectedTiers as readonly string[]).includes(tier)) {
        expect(tag).toBeNull()
        continue
      }
      expect(tag).toBeTruthy()
      expect(tag?.className).toContain(TIER_UI[tier].pill)
    }
  })

  it("does not count future or break cells as achieved tiers", () => {
    const review = makeReview({
      calendar: { ...makeReview().calendar, weeks: [
        ...WEEKS, weekDescriptor(4, { isBreak: true, isSelectable: false }),
      ] },
      semesterGrid: ok([
        weekSummary(1), weekSummary(2),
        weekSummary(3, { phase: "future", hours: [hours("study_session", { tier: "epic" })] }),
        weekSummary(4, { hours: [hours("front_desk", { tier: "legendary" })] }),
      ]),
    })
    render(<MenteeMonitoringClient {...makeProps({ review })} />)
    expect(screen.getByTestId("semester-legend").querySelector("[data-tier]")).toBeNull()
  })

  it("uses the highest rendered tier even when a lower tier appears later", () => {
    const review = makeReview({ semesterGrid: ok([
      weekSummary(1, { phase: "past", hours: [hours("study_session", { tier: "epic" })] }),
      weekSummary(2, { hours: [hours("front_desk", { tier: "rare" })] }),
      weekSummary(3, { phase: "future", hours: [hours("study_session", { tier: "legendary" })] }),
    ]) })
    render(<MenteeMonitoringClient {...makeProps({ review })} />)

    const legend = screen.getByTestId("semester-legend")
    expect(Array.from(legend.querySelectorAll("[data-tier]"), (tag) => tag.getAttribute("data-tier"))).toEqual(["rare", "epic"])
  })

  it("ignores unavailable hourly cells and tiered summaries outside the rendered weeks", () => {
    const review = makeReview({ semesterGrid: ok([
      weekSummary(1, { phase: "past", hours: [] }),
      weekSummary(2),
      weekSummary(3, { phase: "future" }),
      weekSummary(4, { hours: [hours("study_session", { tier: "legendary" })] }),
    ]) })
    render(<MenteeMonitoringClient {...makeProps({ review })} />)

    expect(screen.getByTestId("semester-legend").querySelector("[data-tier]")).toBeNull()
    expect(screen.getByRole("button", { name: /^Front desk: week 1, unavailable/ }).getAttribute("data-tier")).toBeNull()
  })

  it("keeps future week cells non-actionable", () => {
    render(<MenteeMonitoringClient {...makeProps()} />)

    const futureCell = screen.getByRole("button", { name: /^Front desk: week 3, not yet started/ })
    const futureHeader = screen.getByRole("button", { name: "Week 3, Sep 7–Sep 13" })
    expect((futureCell as HTMLButtonElement).disabled).toBe(true)
    expect((futureHeader as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(futureCell.closest("td")!)
    fireEvent.click(futureHeader.closest("th")!)
    expect(mocks.routerPush).not.toHaveBeenCalled()
  })

  it("removes hourly email actions without removing the overdue WAHF email", () => {
    const summary = weekSummary(1, {
      phase: "past",
      hours: [
        hours("front_desk", { percent: 20, band: "red" }),
        hours("study_session", { percent: 20, band: "red" }),
      ],
      wahf: { status: "missing", dueAt: "2026-09-04T03:59:59.999Z", submittedAt: null, onTime: null, submissionId: null },
    })
    render(<MenteeMonitoringClient {...makeProps({
      selectedWeek: 1,
      review: makeReview({ selectedWeek: 1, selectedWeekReview: ok(summary) }),
    })} />)

    const group = screen.getByRole("group", { name: "Weekly requirements" })
    const links = within(group).getAllByRole("link")
    expect(links).toHaveLength(1)
    expect(decodeURIComponent(links[0]!.getAttribute("href")!)).toContain("WAHF")
    for (const title of ["Front desk", "Study sessions"]) {
      expect(within(group).getByText(title).closest('[data-slot="card"]')!.querySelector("a")).toBeNull()
    }
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

  it.each(["rare", "epic", "legendary"] as const)("omits the %s badge from the selected-week header but keeps the status and card badges", (tier) => {
    const review = makeReview({ selectedWeekReview: ok(weekSummary(2, {
      hours: [hours("front_desk", { tier }), hours("study_session", { tier })],
    })) })
    render(<MenteeMonitoringClient {...makeProps({ review })} />)

    const status = screen.getByText("In progress · as of Thursday 3:12pm")
    const heading = screen.getByRole("heading", { name: "Week 2 · Sep 7 – Sep 13" })
    expect(heading.parentElement!.querySelector("[data-tier]")).toBeNull()
    expect(heading.parentElement!.contains(status)).toBe(true)

    const requirements = screen.getByRole("group", { name: "Weekly requirements" })
    const badges = within(requirements).getAllByText(TIER_UI[tier].label)
    expect(badges).toHaveLength(2)
    for (const badge of badges) {
      const metrics = badge.parentElement!
      expect(metrics.getAttribute("data-slot")).toBe("completion-metrics")
      expect(metrics.className).toContain("flex-nowrap")
      expect(within(metrics).getByText("100.0%")).toBeTruthy()
      expect(metrics.parentElement!.parentElement!.querySelector("h3")).toBeTruthy()
    }
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
