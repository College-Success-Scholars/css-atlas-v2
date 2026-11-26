/**
 * @file contracts/form-logs.ts
 * @module shared/contracts
 *
 * Contract for /api/form-logs — submissions of the three scholar forms: MCF
 * (Mentor Check-in Form), WAHF (Weekly Academic Health Form) and WPL (Weekly
 * Performance Log). Reads by Scholar ID or campus week, batch reads, the
 * team-leader completion stats and the recent-submissions feed.
 */
import { campusWeekNumber, endpoint, Schema } from "../contract.js";

export const mcfFormLogRow = Schema.Struct({
  id: Schema.String,
  created_at: Schema.String,
  mentor_name: Schema.NullOr(Schema.String),
  mentor_uid: Schema.NullOr(Schema.String),
  mentee_name: Schema.NullOr(Schema.String),
  mentee_uid: Schema.NullOr(Schema.String),
  meeting_date: Schema.NullOr(Schema.String),
  meeting_time: Schema.NullOr(Schema.String),
  met_in_person: Schema.NullOr(Schema.String),
  reason_no_meeting: Schema.NullOr(Schema.String),
  tasks_completed: Schema.NullOr(Schema.String),
  meeting_notes: Schema.NullOr(Schema.String),
  tutoring_status: Schema.NullOr(Schema.String),
  needs_tutor: Schema.NullOr(Schema.String),
  support_rank: Schema.NullOr(Schema.String),
  submitted_by_email: Schema.NullOr(Schema.String),
});
export type McfFormLogRow = typeof mcfFormLogRow.Type;

export const wahfFormLogRow = Schema.Struct({
  id: Schema.String,
  created_at: Schema.String,
  scholar_uid: Schema.NullOr(Schema.String),
  scholar_name: Schema.NullOr(Schema.String),
  team_leader_contact: Schema.NullOr(Schema.String),
  tl_meeting_in_person: Schema.NullOr(Schema.String),
  course_changes: Schema.NullOr(Schema.String),
  /** e.g. { "CMSC420": { "Exam": "90%" }, "ECON200": { "Exam": "95%" } } */
  assignment_grades: Schema.NullOr(Schema.Record(Schema.String, Schema.Record(Schema.String, Schema.String))),
  missed_classes: Schema.NullOr(Schema.String),
  missed_assignments: Schema.NullOr(Schema.String),
  submitted_by_email: Schema.NullOr(Schema.String),
  course_change_details: Schema.NullOr(Schema.String),
});
export type WahfFormLogRow = typeof wahfFormLogRow.Type;

export const wplFormLogRow = Schema.Struct({
  /** Matches `wpl_form_logs.id` (bigint). */
  id: Schema.Number,
  created_at: Schema.NullOr(Schema.String),
  full_name: Schema.NullOr(Schema.String),
  scholar_uid: Schema.NullOr(Schema.String),
  hours_worked: Schema.NullOr(Schema.Number),
  projects: Schema.Unknown,
  met_with_all: Schema.NullOr(Schema.String),
  explanation: Schema.NullOr(Schema.String),
  submitted_by_email: Schema.NullOr(Schema.String),
});
export type WplFormLogRow = typeof wplFormLogRow.Type;

const lateFlag = { isLate: Schema.Boolean };

/** A row flagged late against the week it belongs to. */
export const mcfFormLogRowWithLate = Schema.Struct({ ...mcfFormLogRow.fields, ...lateFlag });
export const wahfFormLogRowWithLate = Schema.Struct({ ...wahfFormLogRow.fields, ...lateFlag });
export const wplFormLogRowWithLate = Schema.Struct({ ...wplFormLogRow.fields, ...lateFlag });

export const activityFormType = Schema.Literals(["WAHF", "WPL", "MCF"]);
export type ActivityFormType = typeof activityFormType.Type;

export const recentFormSubmission = Schema.Struct({
  id: Schema.String,
  formType: activityFormType,
  submittedAt: Schema.NullOr(Schema.String),
  assignment_grades: Schema.optional(Schema.Unknown),
  course_changes: Schema.optional(Schema.NullOr(Schema.String)),
  missed_classes: Schema.optional(Schema.NullOr(Schema.String)),
  missed_assignments: Schema.optional(Schema.NullOr(Schema.String)),
  course_change_details: Schema.optional(Schema.NullOr(Schema.String)),
  hours_worked: Schema.optional(Schema.NullOr(Schema.Number)),
  projects: Schema.optional(Schema.Unknown),
  met_with_all: Schema.optional(Schema.NullOr(Schema.String)),
  explanation: Schema.optional(Schema.NullOr(Schema.String)),
  mentee_name: Schema.optional(Schema.NullOr(Schema.String)),
  meeting_date: Schema.optional(Schema.NullOr(Schema.String)),
  meeting_time: Schema.optional(Schema.NullOr(Schema.String)),
  met_in_person: Schema.optional(Schema.NullOr(Schema.String)),
  tasks_completed: Schema.optional(Schema.NullOr(Schema.String)),
  meeting_notes: Schema.optional(Schema.NullOr(Schema.String)),
  needs_tutor: Schema.optional(Schema.NullOr(Schema.String)),
});
export type RecentFormSubmission = typeof recentFormSubmission.Type;

export const teamLeaderFormStatsRow = Schema.Struct({
  scholarId: Schema.String,
  name: Schema.String,
  programRole: Schema.NullOr(Schema.String),
  mcfCompleted: Schema.Number,
  mcfRequired: Schema.Number,
  mcfLate: Schema.Boolean,
  mcfPct: Schema.Number,
  mcfLatestAt: Schema.String,
  wahfCompleted: Schema.Number,
  wahfRequired: Schema.Number,
  wahfLate: Schema.Boolean,
  wahfPct: Schema.Number,
  wahfLatestAt: Schema.String,
  wplCompleted: Schema.Number,
  wplRequired: Schema.Number,
  wplLate: Schema.Boolean,
  wplPct: Schema.Number,
  wplLatestAt: Schema.String,
});
export type TeamLeaderFormStatsRow = typeof teamLeaderFormStatsRow.Type;

const uidParams = Schema.Struct({ uid: Schema.String.check(Schema.isMinLength(1, { message: "is required" })) });
const weekParams = Schema.Struct({ week_num: campusWeekNumber });
const uidsBody = { uids: Schema.optional(Schema.Array(Schema.String)) };

/** One scholar's submissions, oldest first. A scholar may read their own; a team leader anyone's. */
export const getMcfByUid = endpoint({
  method: "GET",
  path: "/api/form-logs/mcf/uid/:uid",
  access: { selfOrTeamLeader: "params.uid" },
  params: uidParams,
  output: Schema.Array(mcfFormLogRow),
});

export const getWahfByUid = endpoint({
  method: "GET",
  path: "/api/form-logs/wahf/uid/:uid",
  access: { selfOrTeamLeader: "params.uid" },
  params: uidParams,
  output: Schema.Array(wahfFormLogRow),
});

export const getWplByUid = endpoint({
  method: "GET",
  path: "/api/form-logs/wpl/uid/:uid",
  access: { selfOrTeamLeader: "params.uid" },
  params: uidParams,
  output: Schema.Array(wplFormLogRow),
});

/** Every submission in a campus week, each flagged late or on time. */
export const getMcfWeekWithLate = endpoint({
  method: "GET",
  path: "/api/form-logs/mcf/week/:week_num/with-late",
  access: "team_leader",
  params: weekParams,
  output: Schema.Array(mcfFormLogRowWithLate),
});

export const getWahfWeekWithLate = endpoint({
  method: "GET",
  path: "/api/form-logs/wahf/week/:week_num/with-late",
  access: "team_leader",
  params: weekParams,
  output: Schema.Array(wahfFormLogRowWithLate),
});

export const getWplWeekWithLate = endpoint({
  method: "GET",
  path: "/api/form-logs/wpl/week/:week_num/with-late",
  access: "team_leader",
  params: weekParams,
  output: Schema.Array(wplFormLogRowWithLate),
});

/** MCF submissions for many scholars, matched on mentor (default) or mentee. No uids answers an empty list. */
export const getMcfByUids = endpoint({
  method: "POST",
  path: "/api/form-logs/mcf/by-uids",
  access: "team_leader",
  body: Schema.Struct({
    ...uidsBody,
    field: Schema.optional(Schema.Literals(["mentor_uid", "mentee_uid"])),
  }),
  output: Schema.Array(mcfFormLogRow),
});

export const getWahfByUids = endpoint({
  method: "POST",
  path: "/api/form-logs/wahf/by-uids",
  access: "team_leader",
  body: Schema.Struct(uidsBody),
  output: Schema.Array(wahfFormLogRow),
});

export const getWplByUids = endpoint({
  method: "POST",
  path: "/api/form-logs/wpl/by-uids",
  access: "team_leader",
  body: Schema.Struct(uidsBody),
  output: Schema.Array(wplFormLogRow),
});

/** A scholar's recent submissions. Scholars see WAHF ids and times only; team leaders see the payloads. */
export const getRecentSubmissions = endpoint({
  method: "POST",
  path: "/api/form-logs/recent-submissions",
  access: { selfOrTeamLeader: "body.scholarId" },
  body: Schema.Struct({ scholarId: Schema.optional(Schema.Trim) }),
  output: Schema.Array(recentFormSubmission),
});

/** Per team leader, MCF/WAHF/WPL completion and lateness for a campus week. */
export const getTeamLeaderStats = endpoint({
  method: "POST",
  path: "/api/form-logs/team-leader-stats",
  access: "team_leader",
  body: weekParams,
  output: Schema.Array(teamLeaderFormStatsRow),
});

/** One MCF (uuid id) or WPL (numeric id) submission by id. */
export const getById = endpoint({
  method: "GET",
  path: "/api/form-logs/:form_type/:id",
  access: "team_leader",
  params: Schema.Struct({
    form_type: Schema.Literals(["mcf", "wpl"]).annotate({ message: "is unsupported" }),
    id: Schema.String.check(Schema.isMinLength(1, { message: "is required" })),
  }),
  output: Schema.Union([mcfFormLogRow, wplFormLogRow]),
});
