/**
 * @file contracts/dev.ts
 * @module shared/contracts
 *
 * Contract for developer-only tools: diagnostics, test-profile switching,
 * roster editing, the freshman and sophomore grades report, and the FD/SS
 * schedule board. Every endpoint requires the developer role.
 */
import { endpoint, Schema, SchemaTransformation, scholarId } from "../contract.js";

const nonNegativeInt = Schema.Number.check(
  Schema.isInt({ message: "must be a whole number" }),
  Schema.isGreaterThanOrEqualTo(0, { message: "must be 0 or more" }),
);

// ---------------------------------------------------------------------------
// Diagnostics and test profiles
// ---------------------------------------------------------------------------

export const devPing = Schema.Struct({
  ok: Schema.Boolean,
  message: Schema.String,
  /** The signed-in user's auth email. */
  user: Schema.NullOr(Schema.String),
  timestamp: Schema.String,
});
export type DevPing = typeof devPing.Type;

const authUser = Schema.Struct({ id: Schema.String, email: Schema.NullOr(Schema.String) });

export const devMe = Schema.Struct({
  user: authUser,
  profile: Schema.NullOr(
    Schema.Struct({ app_role: Schema.NullOr(Schema.String), email: Schema.NullOr(Schema.String) }),
  ),
  activeTestProfileId: Schema.NullOr(Schema.String),
  isActingAsTestProfile: Schema.Boolean,
});
export type DevMe = typeof devMe.Type;

/** A row of `dev_test_profiles`: a persona a developer can act as. */
export const devTestProfile = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  roster_uid: Schema.String,
  program_role: Schema.optional(Schema.NullOr(Schema.String)),
  app_role: Schema.optional(Schema.NullOr(Schema.String)),
  first_name: Schema.optional(Schema.NullOr(Schema.String)),
  last_name: Schema.optional(Schema.NullOr(Schema.String)),
  cohort: Schema.optional(Schema.NullOr(Schema.Number)),
  fd_required: Schema.optional(Schema.NullOr(Schema.Number)),
  ss_required: Schema.optional(Schema.NullOr(Schema.Number)),
  teams: Schema.optional(Schema.NullOr(Schema.Array(Schema.String))),
  mentee_uids: Schema.optional(Schema.NullOr(Schema.Array(Schema.String))),
  mentee_count: Schema.optional(Schema.NullOr(Schema.Number)),
});
export type DevTestProfile = typeof devTestProfile.Type;

/** An effective or real profile row, passed through as the database returns it. */
const profileRecord = Schema.Record(Schema.String, Schema.Unknown);

export const activeProfile = Schema.Struct({
  user: authUser,
  profile: Schema.NullOr(profileRecord),
  realProfile: Schema.NullOr(profileRecord),
  activeTestProfileId: Schema.NullOr(Schema.String),
  isActingAsTestProfile: Schema.Boolean,
  isDeveloper: Schema.Boolean,
});
export type ActiveProfile = typeof activeProfile.Type;

/** Confirm the developer API is reachable. */
export const ping = endpoint({ method: "GET", path: "/api/dev/test", access: "developer", output: devPing });

/** Who the backend thinks is calling, and whether they are acting as a test profile. */
export const me = endpoint({ method: "GET", path: "/api/dev/me", access: "developer", output: devMe });

/** Active test profiles, by label. */
export const listTestProfiles = endpoint({
  method: "GET",
  path: "/api/dev/test-profiles",
  access: "developer",
  output: Schema.Array(devTestProfile),
});

/**
 * Check that a test profile exists before the client sets its cookie. A null
 * `testProfileId` (or none) stops acting as a test profile.
 */
export const setActiveProfile = endpoint({
  method: "POST",
  path: "/api/dev/active-profile",
  access: "developer",
  body: Schema.Struct({ testProfileId: Schema.optional(Schema.NullOr(Schema.String)) }),
  output: activeProfile,
});

// ---------------------------------------------------------------------------
// Freshman and sophomore grades
// ---------------------------------------------------------------------------

export const freshmanGradeHoursWeek = Schema.Struct({
  loggedMinutes: Schema.Number,
  excuseMinutes: Schema.Number,
  effectiveMinutes: Schema.Number,
  requiredMinutes: Schema.NullOr(Schema.Number),
  /** Uncapped completion. Null when required minutes are missing or zero. */
  rawPct: Schema.NullOr(Schema.Number),
  /** Capped at 100. Null when the week is not scored. */
  cappedPct: Schema.NullOr(Schema.Number),
});
export type FreshmanGradeHoursWeek = typeof freshmanGradeHoursWeek.Type;

export const freshmanGradeWeekBreakdown = Schema.Struct({
  weekNum: Schema.Number,
  fd: freshmanGradeHoursWeek,
  ss: freshmanGradeHoursWeek,
  wahfStatus: Schema.Literals(["on-time", "late", "missing"]),
  wahfPct: Schema.Number,
});
export type FreshmanGradeWeekBreakdown = typeof freshmanGradeWeekBreakdown.Type;

export const freshmanGradeRow = Schema.Struct({
  scholarId: Schema.String,
  scholarName: Schema.String,
  mentor: Schema.String,
  cohort: Schema.Number,
  fdPct: Schema.NullOr(Schema.Number),
  ssPct: Schema.NullOr(Schema.Number),
  wahfPct: Schema.NullOr(Schema.Number),
  weeks: Schema.Array(freshmanGradeWeekBreakdown),
});
export type FreshmanGradeRow = typeof freshmanGradeRow.Type;

export const freshmanGradesReport = Schema.Struct({
  /** Current campus week. 0 before the semester starts. */
  throughWeek: Schema.Number,
  /** Weeks that are scored: week 2 through the week before throughWeek. */
  scoredWeeks: Schema.NullOr(Schema.Struct({ fromWeek: Schema.Number, throughWeek: Schema.Number })),
  weights: Schema.Struct({
    fd: Schema.Number,
    ss: Schema.Number,
    wahf: Schema.Number,
    outOfApp: Schema.Number,
  }),
  scholars: Schema.Array(freshmanGradeRow),
});
export type FreshmanGradesReport = typeof freshmanGradesReport.Type;
export type FreshmanGradesScoredWeeks = NonNullable<FreshmanGradesReport["scoredWeeks"]>;

/** Enrolled freshmen and sophomores who owe hours, with capped weekly FD/SS/WAHF averages. */
export const getFreshmanGrades = endpoint({
  method: "GET",
  path: "/api/dev/freshman-grades",
  access: "developer",
  output: freshmanGradesReport,
});

// ---------------------------------------------------------------------------
// Schedule board
// ---------------------------------------------------------------------------

const shiftKind = Schema.Literals(["front_desk", "study_session"]).annotate({
  message: "must be front_desk or study_session",
});

export const scheduleBoardShift = Schema.Struct({
  id: Schema.String,
  kind: shiftKind,
  /** 0=Sun … 6=Sat. */
  dayOfWeek: Schema.Number,
  startTime: Schema.String,
  endTime: Schema.String,
});
export type ScheduleBoardShift = typeof scheduleBoardShift.Type;

export const scheduleBoardScholar = Schema.Struct({
  uid: Schema.String,
  name: Schema.String,
  cohort: Schema.NullOr(Schema.Number),
  classYearLabel: Schema.NullOr(Schema.Literals(["Freshman", "Sophomore"])),
  fd_required: Schema.Number,
  ss_required: Schema.Number,
  shifts: Schema.Array(scheduleBoardShift),
});
export type ScheduleBoardScholar = typeof scheduleBoardScholar.Type;

export const scheduleBoard = Schema.Struct({ scholars: Schema.Array(scheduleBoardScholar) });
export type ScheduleBoard = typeof scheduleBoard.Type;

/** One standing shift to save. Clock times are HH:MM; the service checks them. */
export const standingShiftInput = Schema.Struct({
  kind: shiftKind,
  dayOfWeek: Schema.Number,
  startTime: Schema.String,
  endTime: Schema.String,
});
export type StandingShiftInput = typeof standingShiftInput.Type;

export const replaceShiftsResult = Schema.Struct({
  uid: Schema.String,
  shifts: Schema.Array(scheduleBoardShift),
});
export type ReplaceShiftsResult = typeof replaceShiftsResult.Type;

/** Hour-eligible scholars with their standing front desk and study session shifts. */
export const getScheduleBoard = endpoint({
  method: "GET",
  path: "/api/dev/schedule-board",
  access: "developer",
  output: scheduleBoard,
});

/** Replace a scholar's standing shifts for the active semester. An empty list clears them. */
export const replaceShifts = endpoint({
  method: "PUT",
  path: "/api/dev/schedule-board/:uid",
  access: "developer",
  params: Schema.Struct({ uid: scholarId }),
  body: Schema.Struct({ shifts: Schema.Array(standingShiftInput) }),
  output: replaceShiftsResult,
});

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

export const rosterRow = Schema.Struct({
  id: Schema.Number,
  uid: Schema.String,
  created_at: Schema.String,
  first_name: Schema.NullOr(Schema.String),
  last_name: Schema.NullOr(Schema.String),
  phone_number: Schema.NullOr(Schema.String),
  email: Schema.NullOr(Schema.String),
  cohort: Schema.NullOr(Schema.Number),
  status: Schema.NullOr(Schema.String),
  app_role: Schema.NullOr(Schema.String),
  program_role: Schema.NullOr(Schema.String),
  fd_required: Schema.NullOr(Schema.Number),
  ss_required: Schema.NullOr(Schema.Number),
  mentee_count: Schema.NullOr(Schema.Number),
  majors: Schema.NullOr(Schema.Array(Schema.String)),
  minors: Schema.NullOr(Schema.Array(Schema.String)),
  mentee_uids: Schema.NullOr(Schema.Array(Schema.String)),
  teams: Schema.NullOr(Schema.Array(Schema.String)),
  invite_accepted_at: Schema.NullOr(Schema.String),
  invite_sent_at: Schema.NullOr(Schema.String),
});
export type RosterRow = typeof rosterRow.Type;

/** Trimmed text, with blank text becoming null. */
const rosterText = Schema.NullOr(Schema.String).pipe(
  Schema.decodeTo(
    Schema.NullOr(Schema.String),
    SchemaTransformation.transform({
      decode: (text: string | null) => (text?.trim() ? text.trim() : null),
      encode: (text: string | null) => text,
    }),
  ),
);

const ROSTER_STATUSES: ReadonlyArray<string> = ["enrolled", "inactive", "graduated"];

const rosterEmail = rosterText.check(
  Schema.makeFilter((email) =>
    email === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? undefined : "is not a valid email",
  ),
);

/** Lowercased enrollment status. */
const rosterStatus = rosterText
  .pipe(
    Schema.decodeTo(
      Schema.NullOr(Schema.String),
      SchemaTransformation.transform<string | null, string | null>({
        decode: (status) => status?.toLowerCase() ?? null,
        encode: (status) => status,
      }),
    ),
  )
  .check(
    Schema.makeFilter((status) =>
      status === null || ROSTER_STATUSES.includes(status) ? undefined : "must be enrolled, inactive, or graduated",
    ),
  );

/** Trimmed, de-duplicated, blanks removed. */
const rosterList = Schema.NullOr(Schema.Array(Schema.String)).pipe(
  Schema.decodeTo(
    Schema.NullOr(Schema.Array(Schema.String)),
    SchemaTransformation.transform<ReadonlyArray<string> | null, ReadonlyArray<string> | null>({
      decode: (list) => (list === null ? null : [...new Set(list.map((item) => item.trim()).filter(Boolean))]),
      encode: (list) => list,
    }),
  ),
);

/** Only the fields present are written. `app_role` is never writable. */
export const rosterPatch = Schema.Struct({
  first_name: Schema.optional(rosterText),
  last_name: Schema.optional(rosterText),
  phone_number: Schema.optional(rosterText),
  email: Schema.optional(rosterEmail),
  cohort: Schema.optional(Schema.NullOr(Schema.Number.check(Schema.isInt({ message: "must be a whole number" })))),
  status: Schema.optional(rosterStatus),
  app_role: Schema.optional(Schema.Unknown.check(Schema.makeFilter(() => "is not writable"))),
  program_role: Schema.optional(rosterText),
  fd_required: Schema.optional(Schema.NullOr(nonNegativeInt)),
  ss_required: Schema.optional(Schema.NullOr(nonNegativeInt)),
  majors: Schema.optional(rosterList),
  minors: Schema.optional(rosterList),
  teams: Schema.optional(rosterList),
  mentee_uids: Schema.optional(rosterList),
});
export type RosterPatch = Omit<typeof rosterPatch.Type, "app_role">;

/** One roster row by Scholar ID, with the profile's app role overlaid. */
export const getRoster = endpoint({
  method: "GET",
  path: "/api/dev/roster/:uid",
  access: "developer",
  params: Schema.Struct({ uid: scholarId }),
  output: rosterRow,
});

/** Update a roster row and its matching profile. Fails when the body has no writable field. */
export const patchRoster = endpoint({
  method: "PATCH",
  path: "/api/dev/roster/:uid",
  access: "developer",
  params: Schema.Struct({ uid: scholarId }),
  body: rosterPatch,
  output: rosterRow,
});
