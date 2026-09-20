import type {
  FormStatus,
  MemoLivePageData,
  ScholarFollowUpIssue,
  ScholarFollowUpRow,
  TeamLeaderPerformanceRow,
  WeeklyMemoViewData,
} from "./types"

const STATUS_SCORE: Record<FormStatus, number> = {
  submitted: 0,
  "on-time": 0,
  missing: 3,
  late: 1,
  incomplete: 2,
  "check-mentees": 0.5,
}

const teamLeaderIssueScore = (row: TeamLeaderPerformanceRow) => {
  const base =
    STATUS_SCORE[row.mcf] +
    STATUS_SCORE[row.wpl] +
    STATUS_SCORE[row.wahf] +
    (row.menteesOk === "check" ? STATUS_SCORE["check-mentees"] : 0)
  const missingCount = [row.mcf, row.wpl, row.wahf].filter((status) => status === "missing").length
  return { base, missingCount }
}

const sortTeamLeaders = (rows: TeamLeaderPerformanceRow[]) => {
  return [...rows].sort((a, b) => {
    const aScore = teamLeaderIssueScore(a)
    const bScore = teamLeaderIssueScore(b)
    if (bScore.base !== aScore.base) return bScore.base - aScore.base
    if (bScore.missingCount !== aScore.missingCount) return bScore.missingCount - aScore.missingCount
    return a.leaderName.localeCompare(b.leaderName)
  })
}

const scholarCombinedCompletion = (row: ScholarFollowUpRow) => (row.frontDeskPct + row.studySessionPct) / 2

const LOW_COMPLETION_THRESHOLD = 75

const mockFollowUpIssues = (row: Omit<ScholarFollowUpRow, "issues">): ScholarFollowUpIssue[] => {
  const issues: ScholarFollowUpIssue[] = []
  if (row.frontDeskPct < LOW_COMPLETION_THRESHOLD) {
    issues.push({
      kind: "front-desk",
      glance: "Front desk",
      pct: row.frontDeskPct,
      requiredMinutes: row.fdRequired,
      insideMinutes: 0,
      outsideMinutes: 0,
    })
  }
  if (row.studySessionPct < LOW_COMPLETION_THRESHOLD) {
    issues.push({
      kind: "study-session",
      glance: "Study session",
      pct: row.studySessionPct,
      requiredMinutes: row.ssRequired,
      insideMinutes: 0,
      outsideMinutes: 0,
    })
  }
  if (row.flags.some((flag) => /grade/i.test(flag))) {
    issues.push({ kind: "grade", glance: "CMSC131 · Midterm", pct: 58 })
  }
  if (row.flags.includes("Missing WAHF")) {
    issues.push({ kind: "wahf", glance: "WAHF", status: "missing", submittedAtLabel: null })
  }
  if (row.flags.includes("Late WAHF")) {
    issues.push({ kind: "wahf", glance: "WAHF", status: "late", submittedAtLabel: "Apr 4, 8:00 AM" })
  }
  return issues
}

const withFollowUpIssues = (row: Omit<ScholarFollowUpRow, "issues">): ScholarFollowUpRow => ({
  ...row,
  issues: mockFollowUpIssues(row),
})

const sortScholars = (rows: ScholarFollowUpRow[]) => {
  return [...rows].sort((a, b) => {
    const aCompletion = scholarCombinedCompletion(a)
    const bCompletion = scholarCombinedCompletion(b)
    if (aCompletion !== bCompletion) return aCompletion - bCompletion
    if (b.issues.length !== a.issues.length) return b.issues.length - a.issues.length
    return a.scholarName.localeCompare(b.scholarName)
  })
}

const baseMemoData: MemoLivePageData = {
  scholars: [] as MemoLivePageData["scholars"],
  teamLeaders: [] as MemoLivePageData["teamLeaders"],
  pieData: { traffic: 0, studySession: 0, formSubmissions: 0 } as unknown as MemoLivePageData["pieData"],
  formCompletionOverall:
    { wahf: 0, wpl: 0, mcf: 0, overall: 0 } as unknown as MemoLivePageData["formCompletionOverall"],
  completedStudy: [] as MemoLivePageData["completedStudy"],
  completedFd: [] as MemoLivePageData["completedFd"],
  trafficWeeklyData: [],
  trafficEntryCountForSelectedWeek: 0,
  trafficSessions: [] as MemoLivePageData["trafficSessions"],
  tutorReports: [] as MemoLivePageData["tutorReports"],
  gradeBreakdown: { high: [], mid: [], low: [] },
  wahfDonut: { total: 0, completeCount: 0, lateCount: 0, percentComplete: 0 },
  teamLeaderFormStats: [] as MemoLivePageData["teamLeaderFormStats"],
  weekLabel: "",
  selectedWeekNumber: 12,
  currentCampusWeek: 12,
}

const weeklyMemoByWeek: Record<number, WeeklyMemoViewData> = {
  12: {
    ...baseMemoData,
    weekLabel: "Apr 14 - Apr 20, 2026",
    selectedWeekNumber: 12,
    weekStartLabel: "Apr 14",
    weekEndLabel: "Apr 20, 2026",
    weekNumber: 12,
    kpis: [
      {
        title: "Visits this week",
        primaryValue: "142",
        secondaryText: "94 total this semester",
        trendText: "up vs last week",
        subStats: [],
      },
      {
        title: "Front desk completion",
        primaryValue: "78%",
        secondaryText: "3 pts vs last week",
        trendText: "",
        subStats: [
          { label: "Freshman", value: "84%" },
          { label: "Sophomore", value: "71%" },
        ],
      },
      {
        title: "Study session completion",
        primaryValue: "82%",
        secondaryText: "2 pts vs last week",
        trendText: "",
        subStats: [
          { label: "Freshman", value: "88%" },
          { label: "Sophomore", value: "75%" },
        ],
      },
      {
        title: "Tutoring sessions held",
        primaryValue: "31",
        secondaryText: "3 empty sessions",
        trendText: "Steady",
        subStats: [],
      },
    ],
    teamLeaderRows: sortTeamLeaders([
      { leaderName: "Rafael Moreno", mcf: "missing", wpl: "on-time", wahf: "late", menteesOk: "check", hasNoMentee: false },
      { leaderName: "Tyler Nguyen", mcf: "submitted", wpl: "on-time", wahf: "missing", menteesOk: "yes", hasNoMentee: false },
      { leaderName: "Simone Carter", mcf: "submitted", wpl: "missing", wahf: "on-time", menteesOk: "yes", hasNoMentee: false },
      { leaderName: "Aisha Brooks", mcf: "submitted", wpl: "on-time", wahf: "on-time", menteesOk: "yes", hasNoMentee: false },
      { leaderName: "Jordan Kim", mcf: "submitted", wpl: "on-time", wahf: "on-time", menteesOk: "yes", hasNoMentee: false },
    ]),
    scholarRows: sortScholars([
      withFollowUpIssues({
        scholarName: "Leo Pham",
        scholarYear: "Freshman",
        teamLeader: "Rafael Moreno",
        flags: ["Missed tutoring", "Missing WAHF", "Low grade"],
        frontDeskPct: 20,
        studySessionPct: 17,
        fdRequired: 120,
        ssRequired: 180,
      }),
      withFollowUpIssues({
        scholarName: "Derek Osei",
        scholarYear: "Sophomore",
        teamLeader: "Aisha Brooks",
        flags: ["Missed study session", "Late WPL", "Low grade"],
        frontDeskPct: 30,
        studySessionPct: 0,
        fdRequired: 120,
        ssRequired: 180,
      }),
      withFollowUpIssues({
        scholarName: "Marcus Webb",
        scholarYear: "Sophomore",
        teamLeader: "Jordan Kim",
        flags: ["Missed study session", "Missing MCF", "Low grade"],
        frontDeskPct: 40,
        studySessionPct: 0,
        fdRequired: 120,
        ssRequired: 180,
      }),
      withFollowUpIssues({
        scholarName: "Kenji Adeyemi",
        scholarYear: "Sophomore",
        teamLeader: "Simone Carter",
        flags: ["Missed study session", "Low grade"],
        frontDeskPct: 60,
        studySessionPct: 0,
        fdRequired: 120,
        ssRequired: 180,
      }),
      withFollowUpIssues({
        scholarName: "Fatima Diallo",
        scholarYear: "Freshman",
        teamLeader: "Tyler Nguyen",
        flags: ["Missed tutoring", "Low grade"],
        frontDeskPct: 50,
        studySessionPct: 47,
        fdRequired: 120,
        ssRequired: 180,
      }),
      withFollowUpIssues({
        scholarName: "Tyler Nguyen",
        scholarYear: "Sophomore",
        teamLeader: "Simone Carter",
        flags: ["Missed tutoring"],
        frontDeskPct: 75,
        studySessionPct: 69,
        fdRequired: 120,
        ssRequired: 180,
      }),
      withFollowUpIssues({
        scholarName: "Amara Johnson",
        scholarYear: "Freshman",
        teamLeader: "Jordan Kim",
        flags: ["Missing WAHF", "Late MCF"],
        frontDeskPct: 71,
        studySessionPct: 65,
        fdRequired: 120,
        ssRequired: 180,
      }),
      withFollowUpIssues({
        scholarName: "Priya Nair",
        scholarYear: "Freshman",
        teamLeader: "Aisha Brooks",
        flags: ["Missing WAHF", "Late WPL"],
        frontDeskPct: 90,
        studySessionPct: 82,
        fdRequired: 120,
        ssRequired: 180,
      }),
    ]),
    tutoringLog: {
      badgeText: "28 sessions",
      rightLabel: "Sessions · Empty sessions",
      tabs: [
        {
          id: "sessions",
          label: "Sessions",
          rows: [
            {
              id: 1,
              scholarName: "Leo Pham",
              dayOfWeek: "Mon",
              tutorName: "Dr. Smith",
              courses: ["Calculus I"],
              startTime: "2:00 PM",
              endTime: "3:00 PM",
            },
            {
              id: 2,
              scholarName: "Fatima Diallo",
              dayOfWeek: "Wed",
              tutorName: "Dr. Jones",
              courses: ["Chemistry"],
              startTime: "4:00 PM",
              endTime: "5:00 PM",
            },
          ],
        },
        {
          id: "empty-sessions",
          label: "Empty sessions",
          rows: [
            { id: 3, scholarName: "EMPTY SESSION", dayOfWeek: "Tue", tutorName: "Dr. Smith", courses: [], startTime: "", endTime: "" },
          ],
        },
      ],
    },
    recognitionBoard: {
      badgeText: "8 grades",
      rightLabel: "90–100% · 70–89% · Below 70%",
      bands: [
        {
          id: "high",
          label: "90 – 100%",
          entries: [
            { scholarName: "Aisha Brooks", course: "CMSC131", assessment: "Quiz 3", grade: "96%", percent: 96 },
            { scholarName: "Jordan Kim", course: "MATH140", assessment: "HW 8", grade: "92%", percent: 92 },
          ],
        },
        {
          id: "mid",
          label: "70 – 89%",
          entries: [{ scholarName: "Priya Nair", course: "ENGL101", assessment: "Essay", grade: "84%", percent: 84 }],
        },
        {
          id: "low",
          label: "Below 70%",
          entries: [
            { scholarName: "Leo Pham", course: "CMSC131", assessment: "Midterm", grade: "58%", percent: 58 },
            { scholarName: "Derek Osei", course: "PHYS161", assessment: "Lab 4", grade: "62%", percent: 62 },
            { scholarName: "Marcus Webb", course: "CMSC131", assessment: "Midterm", grade: "58%", percent: 58 },
            { scholarName: "Kenji Adeyemi", course: "STAT100", assessment: "Quiz", grade: "55%", percent: 55 },
            { scholarName: "Fatima Diallo", course: "CHEM131", assessment: "Exam 1", grade: "64%", percent: 64 },
          ],
        },
      ],
    },
    fullAttendanceDetail: {
      rightLabel: "Front desk · Study sessions · WAHF",
      wahfCensus: { onTime: 31, late: 4, missing: 2 },
      tabs: [
        {
          id: "front-desk",
          label: "Front desk",
          rows: [
            { scholarName: "Aisha Brooks", scholarYear: "Freshman", completedMinutes: 120, excuseMinutes: 0, requiredMinutes: 120, completionPct: 100 },
            { scholarName: "Jordan Kim", scholarYear: "Freshman", completedMinutes: 115, excuseMinutes: 0, requiredMinutes: 120, completionPct: 96 },
            { scholarName: "Simone Carter", scholarYear: "Sophomore", completedMinutes: 110, excuseMinutes: 0, requiredMinutes: 120, completionPct: 92 },
            { scholarName: "Priya Nair", scholarYear: "Freshman", completedMinutes: 108, excuseMinutes: 0, requiredMinutes: 120, completionPct: 90 },
            { scholarName: "Rafael Moreno", scholarYear: "Sophomore", completedMinutes: 95, excuseMinutes: 0, requiredMinutes: 120, completionPct: 79 },
            { scholarName: "Tyler Nguyen", scholarYear: "Sophomore", completedMinutes: 90, excuseMinutes: 0, requiredMinutes: 120, completionPct: 75 },
            { scholarName: "Amara Johnson", scholarYear: "Freshman", completedMinutes: 85, excuseMinutes: 0, requiredMinutes: 120, completionPct: 71 },
            { scholarName: "Kenji Adeyemi", scholarYear: "Sophomore", completedMinutes: 72, excuseMinutes: 0, requiredMinutes: 120, completionPct: 60 },
            { scholarName: "Fatima Diallo", scholarYear: "Freshman", completedMinutes: 60, excuseMinutes: 0, requiredMinutes: 120, completionPct: 50 },
            { scholarName: "Marcus Webb", scholarYear: "Sophomore", completedMinutes: 48, excuseMinutes: 0, requiredMinutes: 120, completionPct: 40 },
            { scholarName: "Derek Osei", scholarYear: "Sophomore", completedMinutes: 36, excuseMinutes: 0, requiredMinutes: 120, completionPct: 30 },
            { scholarName: "Leo Pham", scholarYear: "Freshman", completedMinutes: 24, excuseMinutes: 0, requiredMinutes: 120, completionPct: 20 },
          ],
        },
        {
          id: "study-sessions",
          label: "Study sessions",
          rows: [
            { scholarName: "Aisha Brooks", scholarYear: "Freshman", completedMinutes: 180, excuseMinutes: 0, requiredMinutes: 180, completionPct: 100 },
            { scholarName: "Jordan Kim", scholarYear: "Freshman", completedMinutes: 172, excuseMinutes: 0, requiredMinutes: 180, completionPct: 96 },
            { scholarName: "Simone Carter", scholarYear: "Sophomore", completedMinutes: 166, excuseMinutes: 0, requiredMinutes: 180, completionPct: 92 },
            { scholarName: "Priya Nair", scholarYear: "Freshman", completedMinutes: 162, excuseMinutes: 0, requiredMinutes: 180, completionPct: 90 },
            { scholarName: "Rafael Moreno", scholarYear: "Sophomore", completedMinutes: 143, excuseMinutes: 0, requiredMinutes: 180, completionPct: 79 },
            { scholarName: "Tyler Nguyen", scholarYear: "Sophomore", completedMinutes: 135, excuseMinutes: 0, requiredMinutes: 180, completionPct: 75 },
            { scholarName: "Amara Johnson", scholarYear: "Freshman", completedMinutes: 128, excuseMinutes: 0, requiredMinutes: 180, completionPct: 71 },
            { scholarName: "Kenji Adeyemi", scholarYear: "Sophomore", completedMinutes: 108, excuseMinutes: 0, requiredMinutes: 180, completionPct: 60 },
            { scholarName: "Fatima Diallo", scholarYear: "Freshman", completedMinutes: 90, excuseMinutes: 0, requiredMinutes: 180, completionPct: 50 },
            { scholarName: "Marcus Webb", scholarYear: "Sophomore", completedMinutes: 72, excuseMinutes: 0, requiredMinutes: 180, completionPct: 40 },
            { scholarName: "Derek Osei", scholarYear: "Sophomore", completedMinutes: 54, excuseMinutes: 0, requiredMinutes: 180, completionPct: 30 },
            { scholarName: "Leo Pham", scholarYear: "Freshman", completedMinutes: 36, excuseMinutes: 0, requiredMinutes: 180, completionPct: 20 },
          ],
        },
      ],
    },
  },
  11: {
    ...baseMemoData,
    weekLabel: "Apr 07 - Apr 13, 2026",
    selectedWeekNumber: 11,
    weekStartLabel: "Apr 07",
    weekEndLabel: "Apr 13, 2026",
    weekNumber: 11,
    kpis: [
      {
        title: "Visits this week",
        primaryValue: "136",
        secondaryText: "82 total this semester",
        trendText: "up vs last week",
        subStats: [],
      },
      {
        title: "Front desk completion",
        primaryValue: "75%",
        secondaryText: "1 pt vs last week",
        trendText: "",
        subStats: [
          { label: "Freshman", value: "80%" },
          { label: "Sophomore", value: "70%" },
        ],
      },
      {
        title: "Study session completion",
        primaryValue: "80%",
        secondaryText: "1 pt vs last week",
        trendText: "",
        subStats: [
          { label: "Freshman", value: "85%" },
          { label: "Sophomore", value: "74%" },
        ],
      },
      {
        title: "Tutoring sessions held",
        primaryValue: "29",
        secondaryText: "4 empty sessions",
        trendText: "Steady",
        subStats: [],
      },
    ],
    teamLeaderRows: sortTeamLeaders([
      { leaderName: "Simone Carter", mcf: "late", wpl: "missing", wahf: "on-time", menteesOk: "check", hasNoMentee: false },
      { leaderName: "Rafael Moreno", mcf: "submitted", wpl: "late", wahf: "missing", menteesOk: "yes", hasNoMentee: false },
      { leaderName: "Aisha Brooks", mcf: "submitted", wpl: "on-time", wahf: "on-time", menteesOk: "yes", hasNoMentee: false },
      { leaderName: "Jordan Kim", mcf: "submitted", wpl: "on-time", wahf: "on-time", menteesOk: "yes", hasNoMentee: false },
      { leaderName: "Tyler Nguyen", mcf: "submitted", wpl: "on-time", wahf: "on-time", menteesOk: "yes", hasNoMentee: false },
    ]),
    scholarRows: sortScholars([
      withFollowUpIssues({
        scholarName: "Marcus Webb",
        scholarYear: "Sophomore",
        teamLeader: "Jordan Kim",
        flags: ["Missing MCF", "Low grade"],
        frontDeskPct: 34,
        studySessionPct: 10,
        fdRequired: 120,
        ssRequired: 180,
      }),
      withFollowUpIssues({
        scholarName: "Leo Pham",
        scholarYear: "Freshman",
        teamLeader: "Rafael Moreno",
        flags: ["Missing WAHF", "Low grade"],
        frontDeskPct: 45,
        studySessionPct: 14,
        fdRequired: 120,
        ssRequired: 180,
      }),
    ]),
    tutoringLog: {
      badgeText: "25 sessions",
      rightLabel: "Sessions · Empty sessions",
      tabs: [
        {
          id: "sessions",
          label: "Sessions",
          rows: [
            {
              id: 4,
              scholarName: "Marcus Webb",
              dayOfWeek: "Thu",
              tutorName: "Dr. Lee",
              courses: ["Physics"],
              startTime: "1:00 PM",
              endTime: "2:00 PM",
            },
          ],
        },
        {
          id: "empty-sessions",
          label: "Empty sessions",
          rows: [
            { id: 5, scholarName: "EMPTY SESSION", dayOfWeek: "Fri", tutorName: "Dr. Jones", courses: [], startTime: "", endTime: "" },
          ],
        },
      ],
    },
    recognitionBoard: {
      badgeText: "4 grades",
      rightLabel: "90–100% · 70–89% · Below 70%",
      bands: [
        {
          id: "high",
          label: "90 – 100%",
          entries: [{ scholarName: "Jordan Kim", course: "CMSC131", assessment: "Quiz", grade: "94%", percent: 94 }],
        },
        {
          id: "mid",
          label: "70 – 89%",
          entries: [{ scholarName: "Aisha Brooks", course: "ENGL101", assessment: "Draft", grade: "78%", percent: 78 }],
        },
        {
          id: "low",
          label: "Below 70%",
          entries: [
            { scholarName: "Marcus Webb", course: "CMSC131", assessment: "Midterm", grade: "58%", percent: 58 },
            { scholarName: "Leo Pham", course: "MATH140", assessment: "Exam", grade: "51%", percent: 51 },
          ],
        },
      ],
    },
    fullAttendanceDetail: {
      rightLabel: "Front desk · Study sessions · WAHF",
      wahfCensus: { onTime: 28, late: 2, missing: 2 },
      tabs: [
        {
          id: "front-desk",
          label: "Front desk",
          rows: [
            { scholarName: "Jordan Kim", scholarYear: "Freshman", completedMinutes: 114, excuseMinutes: 0, requiredMinutes: 120, completionPct: 95 },
            { scholarName: "Aisha Brooks", scholarYear: "Freshman", completedMinutes: 108, excuseMinutes: 0, requiredMinutes: 120, completionPct: 90 },
            { scholarName: "Tyler Nguyen", scholarYear: "Sophomore", completedMinutes: 90, excuseMinutes: 0, requiredMinutes: 120, completionPct: 75 },
            { scholarName: "Rafael Moreno", scholarYear: "Sophomore", completedMinutes: 78, excuseMinutes: 0, requiredMinutes: 120, completionPct: 65 },
            { scholarName: "Leo Pham", scholarYear: "Freshman", completedMinutes: 45, excuseMinutes: 0, requiredMinutes: 120, completionPct: 38 },
            { scholarName: "Marcus Webb", scholarYear: "Sophomore", completedMinutes: 34, excuseMinutes: 0, requiredMinutes: 120, completionPct: 28 },
          ],
        },
        {
          id: "study-sessions",
          label: "Study sessions",
          rows: [
            { scholarName: "Jordan Kim", scholarYear: "Freshman", completedMinutes: 170, excuseMinutes: 0, requiredMinutes: 180, completionPct: 94 },
            { scholarName: "Aisha Brooks", scholarYear: "Freshman", completedMinutes: 162, excuseMinutes: 0, requiredMinutes: 180, completionPct: 90 },
            { scholarName: "Tyler Nguyen", scholarYear: "Sophomore", completedMinutes: 132, excuseMinutes: 0, requiredMinutes: 180, completionPct: 73 },
            { scholarName: "Rafael Moreno", scholarYear: "Sophomore", completedMinutes: 118, excuseMinutes: 0, requiredMinutes: 180, completionPct: 66 },
            { scholarName: "Leo Pham", scholarYear: "Freshman", completedMinutes: 32, excuseMinutes: 0, requiredMinutes: 180, completionPct: 18 },
            { scholarName: "Marcus Webb", scholarYear: "Sophomore", completedMinutes: 20, excuseMinutes: 0, requiredMinutes: 180, completionPct: 11 },
          ],
        },
      ],
    },
  },
}

export const getAvailableWeeks = () => Object.keys(weeklyMemoByWeek).map(Number).sort((a, b) => a - b)

export function getWeeklyMemoData(selectedWeek: number): WeeklyMemoViewData {
  return weeklyMemoByWeek[selectedWeek] ?? weeklyMemoByWeek[12]
}
