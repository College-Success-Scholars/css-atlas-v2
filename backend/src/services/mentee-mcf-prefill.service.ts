/**
 * @file mentee-mcf-prefill.service.ts
 * @module backend/services
 *
 * Click-time MCF prefill. `buildMcfPrefill` is pure and maps one current-week
 * summary onto the fixed form entries; `getMenteeMcfPrefill` recomposes the
 * current week from fresh evidence at activation and blocks on any unknown
 * source rather than fabricating a No/completion (design D4, tasks 6.1-6.4).
 *
 * ## Responsibilities
 * - Pure entry mapping (identities, tasks, tutoring, optional meeting fields)
 * - Fresh authorized orchestration returning McfPrefill or an actionable error
 *
 * ## What does NOT belong here
 * - HTTP request/response logic
 * - Weekly classification (mentee-review-evaluator)
 */
import {
  addEasternCalendarDays,
  campusWeekToDateRange,
  getEasternDateParts,
} from "./time.service.js";
import { getMenteeReviewByMentorKey } from "./mentee-review-activity.service.js";
import {
  MCF_ENTRY_IDS,
  MCF_FORM_BASE_URL,
  MCF_TASK_LABELS,
  MCF_TASK_MIN_PERCENT,
  MCF_TUTORING_NO,
  MCF_TUTORING_YES,
  type McfPrefill,
} from "../models/mentee-mcf-prefill.model.js";
import type { MeetingPreferenceOutput } from "../models/meeting-preference.model.js";
import type { HourWeekSummary, WeekReviewSummary } from "../models/mentee-review.model.js";

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Program-local calendar date (YYYY-MM-DD) for an instant. */
export function programLocalDateString(date: Date): string {
  const { year, month, day } = getEasternDateParts(date);
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

/** The saved weekday's date within the week that starts on `weekStartMonday`. */
export function meetingDateForWeekday(weekStartMonday: Date, weekday: number): string {
  return programLocalDateString(addEasternCalendarDays(weekStartMonday, weekday - 1));
}

/**
 * A task counts only against a POSITIVE current-week target and at >= 90% of
 * the UNROUNDED total, regardless of whether a no-show occurred.
 */
export function isMcfTaskComplete(hours: HourWeekSummary | undefined): boolean {
  if (!hours || hours.targetMinutes == null || hours.targetMinutes <= 0) return false;
  const effective = hours.loggedMinutes + (hours.excuseMinutes ?? 0);
  return (effective / hours.targetMinutes) * 100 >= MCF_TASK_MIN_PERCENT;
}

export interface BuildMcfPrefillInput {
  mentor: { fullName: string; uid: string };
  mentee: { fullName: string; uid: string };
  /** Program-local Monday of the current week as an instant. */
  weekStartMonday: Date;
  currentWeek: WeekReviewSummary;
  meetingPreference: MeetingPreferenceOutput | null;
  asOf: Date;
}

export function buildMcfPrefill(input: BuildMcfPrefillInput): McfPrefill {
  const { currentWeek } = input;
  const params = new URLSearchParams();

  params.append(MCF_ENTRY_IDS.mentorName, input.mentor.fullName);
  params.append(MCF_ENTRY_IDS.mentorUid, input.mentor.uid);
  params.append(MCF_ENTRY_IDS.menteeName, input.mentee.fullName);
  params.append(MCF_ENTRY_IDS.menteeUid, input.mentee.uid);

  const frontDesk = currentWeek.hours.find((h) => h.kind === "front_desk");
  const study = currentWeek.hours.find((h) => h.kind === "study_session");
  if (isMcfTaskComplete(frontDesk)) params.append(MCF_ENTRY_IDS.tasksCompleted, MCF_TASK_LABELS.frontDesk);
  if (isMcfTaskComplete(study)) params.append(MCF_ENTRY_IDS.tasksCompleted, MCF_TASK_LABELS.studySessions);
  if (currentWeek.wahf.status === "submitted") params.append(MCF_ENTRY_IDS.tasksCompleted, MCF_TASK_LABELS.wahf);

  params.append(
    MCF_ENTRY_IDS.tutoringAttendance,
    currentWeek.tutoring.recordedAttendance ? MCF_TUTORING_YES : MCF_TUTORING_NO
  );

  // Both meeting fields are omitted when no preference is saved; a saved
  // setting never implies the meeting actually happened.
  if (input.meetingPreference) {
    params.append(
      MCF_ENTRY_IDS.meetingDay,
      meetingDateForWeekday(input.weekStartMonday, input.meetingPreference.weekday)
    );
    params.append(MCF_ENTRY_IDS.meetingTime, input.meetingPreference.meetingTime);
  }

  return {
    url: `${MCF_FORM_BASE_URL}&${params.toString()}`,
    weekStart: programLocalDateString(input.weekStartMonday),
    generatedAt: input.asOf.toISOString(),
  };
}

export type McfPrefillResult =
  | { ok: true; data: McfPrefill }
  | { ok: false; error: { code: string; message: string } };

function block(code: string, message: string): McfPrefillResult {
  return { ok: false, error: { code, message } };
}

/**
 * Fresh, authorized prefill for the CURRENT week at activation time. Recomputes
 * from newly read evidence so a week rollover between page load and click uses
 * the week that is current now. Unknown required evidence blocks the prefill.
 */
export async function getMenteeMcfPrefill(params: {
  mentorId: string;
  mentorFullName: string;
  mentorUid: string | null;
  menteeUid: string;
  asOf?: Date;
}): Promise<McfPrefillResult> {
  const asOf = params.asOf ?? new Date();

  if (!params.mentorUid || !params.mentorUid.trim()) {
    return block(
      "mentor_uid_unavailable",
      "Your roster UID is unavailable, so the form cannot identify you. Ask an admin to check your profile."
    );
  }

  const review = await getMenteeReviewByMentorKey({
    mentorKey: params.mentorId,
    menteeUid: params.menteeUid,
    selectedWeek: null,
    asOf,
  });
  if (!review) {
    return block("mentee_not_found", "This mentee is not among your assignments.");
  }

  if (review.calendar.noActiveWeek || review.currentWeek == null) {
    return block("no_active_week", "There is no active instruction week right now.");
  }
  if (!review.selectedWeekReview.ok) {
    return block(
      "attendance_unavailable",
      "Attendance could not be read right now. Try again before filling the form."
    );
  }
  const currentWeek = review.selectedWeekReview.data;
  if (!currentWeek) {
    return block("no_current_week", "The current week is not available yet.");
  }
  if (currentWeek.wahf.status === "unknown") {
    return block("wahf_unavailable", "WAHF status could not be read right now. Try again before filling the form.");
  }
  if (currentWeek.tutoring.status === "unknown") {
    return block(
      "tutoring_unavailable",
      "Tutoring attendance could not be read right now. Try again before filling the form."
    );
  }
  if (!review.meetingPreference.ok) {
    return block(
      "meeting_preference_unavailable",
      "Your meeting setting could not be read right now. Try again before filling the form."
    );
  }

  const range = campusWeekToDateRange(review.currentWeek);
  if (!range) {
    return block("no_active_week", "There is no active instruction week right now.");
  }

  return {
    ok: true,
    data: buildMcfPrefill({
      mentor: { fullName: params.mentorFullName, uid: params.mentorUid },
      mentee: { fullName: review.mentee.fullName, uid: review.mentee.uid },
      weekStartMonday: range.startDate,
      currentWeek,
      meetingPreference: review.meetingPreference.data,
      asOf,
    }),
  };
}
