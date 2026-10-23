/**
 * @file mentee-mcf-prefill.model.ts
 * @module backend/models
 *
 * Constants and types for the click-time MCF (Mentor Check-in Form) prefill.
 * The form host and entry map are FIXED here and are never accepted from the
 * browser (design D4). Values are appended as query parameters; the form is
 * only ever opened for review and never submitted.
 *
 * ## What belongs here
 * - The fixed form URL, entry IDs, task labels, and the McfPrefill type
 *
 * ## What does NOT belong here
 * - URL construction (mentee-mcf-prefill.service)
 * - Queries or HTTP handlers
 */

/** Fixed host + form id; the base URL already carries `?usp=pp_url`. */
export const MCF_FORM_BASE_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSeaa-aUkIhUzl-WZnlGSMmdx0sJbjQhK6fZniJwL6azT5czkg/viewform?usp=pp_url";

/** Prefilled entry IDs, exactly as published in the capability spec. */
export const MCF_ENTRY_IDS = {
  mentorName: "entry.1658913329",
  mentorUid: "entry.523669521",
  menteeName: "entry.837663386",
  menteeUid: "entry.866941707",
  meetingDay: "entry.392801788",
  meetingTime: "entry.1480334015",
  tasksCompleted: "entry.160452631",
  tutoringAttendance: "entry.1514937183",
} as const;

/**
 * Attestation fields intentionally left blank by OMITTING their parameters.
 * Never append these keys.
 */
export const MCF_OMITTED_ENTRY_IDS = {
  metInPerson: "entry.211426866",
  absenceReason: "entry.667939163",
  meetingNotes: "entry.360587139",
  needsTutor: "entry.1975881923",
  supportNeed: "entry.1471104305",
} as const;

/** Exact checkbox labels accepted by the form's "Tasks completed" item. */
export const MCF_TASK_LABELS = {
  frontDesk: "Front Desk",
  studySessions: "Study Sessions",
  wahf: "WAHF",
} as const;

/** A task is included only at or above this percent of a POSITIVE current-week target. */
export const MCF_TASK_MIN_PERCENT = 90;

export const MCF_TUTORING_YES = "Yes";
export const MCF_TUTORING_NO = "No";

/** Result of a click-time prefill build; carries no submission side effects. */
export interface McfPrefill {
  /** Fully encoded Google Forms URL, ready to open in a new tab. */
  url: string;
  /** Program-local current-week Monday, YYYY-MM-DD. */
  weekStart: string;
  /** ISO instant the URL was constructed. */
  generatedAt: string;
}
