import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type {
  HourWeekSummary,
  MenteeReview,
  MenteeReviewClientProps,
  SectionResult,
  WeekReviewSummary,
} from "@/lib/types/mentee-review"

const mocks = vi.hoisted(() => ({
  getCurrentProfile: vi.fn(),
  canAccessMenteeMonitoring: vi.fn(),
  canAccessWeeklyMemo: vi.fn(),
  fetchMentees: vi.fn(),
  fetchMenteeReview: vi.fn(),
  fetchDirectoryMenteeReview: vi.fn(),
  dateToCampusWeek: vi.fn(),
  applyWeekTiers: vi.fn((review: MenteeReview) => review),
  client: vi.fn((_props: MenteeReviewClientProps) =>
    React.createElement("section", { "data-testid": "mentee-monitoring-client" })
  ),
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`) }),
  notFound: vi.fn(() => { throw new Error("not-found") }),
}))

vi.mock("@/lib/server/queries", () => ({ getCurrentProfile: mocks.getCurrentProfile }))
vi.mock("@/lib/auth", () => ({
  canAccessMenteeMonitoring: mocks.canAccessMenteeMonitoring,
  canAccessWeeklyMemo: mocks.canAccessWeeklyMemo,
}))
vi.mock("@/lib/server/data", () => ({
  fetchMentees: mocks.fetchMentees,
  fetchMenteeReview: mocks.fetchMenteeReview,
  fetchDirectoryMenteeReview: mocks.fetchDirectoryMenteeReview,
}))
vi.mock("@/lib/format/time", () => ({ dateToCampusWeek: mocks.dateToCampusWeek }))
vi.mock("@/lib/tiers", () => ({ applyWeekTiers: mocks.applyWeekTiers }))
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: mocks.notFound }))
vi.mock("@/components/mentee-monitoring/mentee-monitoring-client", () => ({
  MenteeMonitoringClient: mocks.client,
}))
vi.mock("@/components/mentee-monitoring/mentee-review.module.css", () => ({
  default: { surface: "surface" },
}))

import MenteePage from "./page"
import DirectoryScholarPage from "../directory/[uid]/page"

const AS_OF = "2026-09-10T19:12:00.000Z"
const UID = "123456789"
const PROFILE = { uid: "leader", role: "team_leader" }

function ok<T>(data: T): SectionResult<T> {
  return { ok: true, data, loadedAt: AS_OF }
}

function highCompletionWeek(weekNumber: number): WeekReviewSummary {
  const hours: HourWeekSummary[] = ["front_desk", "study_session"].map((kind) => ({
    kind: kind as HourWeekSummary["kind"],
    assignmentAvailable: true,
    loggedMinutes: 240,
    excuseMinutes: 0,
    excuseDescription: null,
    targetMinutes: 120,
    percent: 200,
    band: "green",
    displayHours: 4,
    overageMinutes: 120,
    pending: false,
    noShowCount: 0,
    hasActivity: true,
    shifts: [],
    offShiftLogs: [],
  }))

  return {
    weekNumber,
    weekStart: "2026-09-07T04:00:00.000Z",
    weekEnd: "2026-09-13T04:00:00.000Z",
    phase: "past",
    hours,
    wahf: {
      status: "submitted",
      dueAt: AS_OF,
      submittedAt: AS_OF,
      onTime: true,
      submissionId: "wahf-1",
    },
    tutoring: { status: "none", recordedAttendance: false, reports: [] },
  }
}

function rawReview(): MenteeReview {
  return {
    asOf: AS_OF,
    mentee: { uid: UID, fullName: "Test Mentee", email: "test@umd.edu", cohort: 2026 },
    calendar: {
      semesterId: "1",
      semesterStart: "2026-08-31T04:00:00.000Z",
      semesterEnd: "2026-12-12T04:00:00.000Z",
      currentWeek: 3,
      weeks: [],
      noActiveWeek: false,
    },
    currentWeek: 3,
    selectedWeek: 2,
    semesterGrid: ok([highCompletionWeek(1), highCompletionWeek(2)]),
    selectedWeekReview: ok(highCompletionWeek(2)),
    latestGrades: ok({ status: "empty", submissionId: null, submittedAt: null, entries: [] }),
    meetingPreference: ok(null),
  }
}

function expectUndecoratedReview(review: MenteeReview) {
  const props = mocks.client.mock.calls[0][0]
  expect(props.review).toBe(review)
  expect(props.review?.semesterGrid).toBe(review.semesterGrid)
  expect(props.review?.selectedWeekReview).toBe(review.selectedWeekReview)
  expect(mocks.applyWeekTiers).not.toHaveBeenCalled()

  if (!props.review?.semesterGrid.ok || !props.review.selectedWeekReview.ok) {
    throw new Error("Expected successful raw review sections")
  }
  const weeks = [...props.review.semesterGrid.data, props.review.selectedWeekReview.data!]
  for (const week of weeks) {
    for (const hours of week.hours) {
      expect(hours.percent).toBe(200)
      expect(hours.band).toBe("green")
      expect(hours).not.toHaveProperty("tier")
    }
  }
  expect(mocks.redirect).not.toHaveBeenCalled()
  expect(mocks.notFound).not.toHaveBeenCalled()
}

describe("mentee review pages with tiers temporarily disabled", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentProfile.mockResolvedValue(PROFILE)
    mocks.canAccessMenteeMonitoring.mockReturnValue(true)
    mocks.canAccessWeeklyMemo.mockReturnValue(true)
    mocks.dateToCampusWeek.mockReturnValue(3)
  })

  it("passes the assigned mentee's raw review to the client without decorating high completion", async () => {
    const review = rawReview()
    const mentees = [
      { uid: "987654321", fullName: "Other Mentee", email: null },
      review.mentee,
    ]
    mocks.fetchMentees.mockResolvedValue(mentees)
    mocks.fetchMenteeReview.mockResolvedValue(review)

    renderToStaticMarkup(await MenteePage({
      searchParams: Promise.resolve({ week: "2", uid: UID }),
    }))

    expect(mocks.canAccessMenteeMonitoring).toHaveBeenCalledWith(PROFILE)
    expect(mocks.fetchMenteeReview).toHaveBeenCalledWith(UID, 2)
    expect(mocks.fetchDirectoryMenteeReview).not.toHaveBeenCalled()
    expect(mocks.client).toHaveBeenCalledTimes(1)
    expect(mocks.client.mock.calls[0][0]).toEqual({ mentees, review, selectedWeek: 2 })
    expect(mocks.client.mock.calls[0][0].mentees).toBe(mentees)
    expectUndecoratedReview(review)
  })

  it("passes the directory scholar's raw review and cohort-aware detail path to the client", async () => {
    const review = rawReview()
    mocks.fetchDirectoryMenteeReview.mockResolvedValue(review)

    renderToStaticMarkup(await DirectoryScholarPage({
      params: Promise.resolve({ uid: ` ${UID} ` }),
      searchParams: Promise.resolve({ week: "2", cohort: "2026" }),
    }))

    expect(mocks.canAccessWeeklyMemo).toHaveBeenCalledWith(PROFILE)
    expect(mocks.fetchDirectoryMenteeReview).toHaveBeenCalledWith(UID, 2)
    expect(mocks.fetchMenteeReview).not.toHaveBeenCalled()
    expect(mocks.fetchMentees).not.toHaveBeenCalled()
    expect(mocks.client).toHaveBeenCalledTimes(1)
    expect(mocks.client.mock.calls[0][0]).toEqual({
      mentees: [review.mentee],
      review,
      selectedWeek: 2,
      detailPath: `/dashboard/directory/${UID}?cohort=2026`,
    })
    expectUndecoratedReview(review)
  })
})
