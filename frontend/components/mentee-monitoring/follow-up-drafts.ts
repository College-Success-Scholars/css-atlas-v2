/**
 * @file follow-up-drafts.ts
 * @module frontend/components/mentee-monitoring
 *
 * Pure builder for follow-up email drafts (task 6.5). Returns `mailto:` drafts
 * only for confirmed no-shows, ended weeks below 90% hours, or a missing
 * overdue WAHF. Nothing is ever sent, opened, or copied here — the caller
 * renders an anchor the user decides to click.
 *
 * Tutoring follow-ups are deliberately absent (request/session evidence is
 * unsupported).
 */
import { EASTERN_TIMEZONE } from "@/lib/format/time";
import type {
  HourWeekSummary,
  ShiftEvidence,
  ShiftSessionKind,
  WahfWeekSummary,
  WeekPhase,
} from "@/lib/types/mentee-review";

export const FRONT_DESK_FOLLOW_UP_CC = "cssfd@umd.edu";
export const STUDY_FOLLOW_UP_CC = "css_ss@umd.edu";

/** An "ended week" below this percent of target earns a draft. */
export const HOURS_UNDER_TARGET_PERCENT = 90;

export type FollowUpReason = "front_desk" | "study_session" | "wahf";

export interface FollowUpDraft {
  id: FollowUpReason;
  /** Short link label, e.g. "Email Ada about this". */
  label: string;
  to: string;
  cc: string | null;
  subject: string;
  body: string;
  /** Ready-to-use mailto URL, or null when the scholar has no email (launch disabled). */
  href: string | null;
}

export interface BuildFollowUpDraftsInput {
  menteeFirstName: string;
  menteeEmail: string | null;
  weekNumber: number;
  /** ISO instants. */
  weekStart: string;
  weekEnd: string;
  phase: WeekPhase;
  hours: HourWeekSummary[];
  wahf: WahfWeekSummary;
}

const KIND_LABELS: Record<ShiftSessionKind, string> = {
  front_desk: "Front desk",
  study_session: "Study sessions",
};

function time12(date: Date): string {
  return date
    .toLocaleTimeString("en-US", {
      timeZone: EASTERN_TIMEZONE,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase()
    .replace(/\s/g, "");
}

function shortDate(date: Date, weekday: boolean): string {
  return date.toLocaleDateString("en-US", {
    timeZone: EASTERN_TIMEZONE,
    ...(weekday ? { weekday: "long" as const } : {}),
    month: "short",
    day: "numeric",
  });
}

function shiftLabel(shift: ShiftEvidence): string {
  return `${shortDate(new Date(shift.scheduledStart), true)}, ${time12(
    new Date(shift.scheduledStart)
  )}–${time12(new Date(shift.scheduledEnd))}`;
}

function weekLabel(input: BuildFollowUpDraftsInput): string {
  const start = shortDate(new Date(input.weekStart), false);
  const end = shortDate(new Date(input.weekEnd), false);
  return `Week ${input.weekNumber} (${start} – ${end})`;
}

function hoursDraft(
  kind: ShiftSessionKind,
  hours: HourWeekSummary,
  input: BuildFollowUpDraftsInput
): FollowUpDraft | null {
  const noShows = hours.shifts.filter((shift) => shift.status === "no_show");
  const endedBelowTarget =
    input.phase === "past" && hours.percent != null && hours.percent < HOURS_UNDER_TARGET_PERCENT;
  if (noShows.length === 0 && !endedBelowTarget) return null;

  const lines: string[] = [`Hi ${input.menteeFirstName},`, "", `Checking in about ${weekLabel(input)}.`, ""];
  if (noShows.length > 0) {
    lines.push(`${KIND_LABELS[kind]} — missed shifts:`);
    for (const shift of noShows) lines.push(`- ${shiftLabel(shift)}: no hours were logged.`);
    lines.push("");
  }
  if (hours.targetMinutes != null && hours.targetMinutes > 0) {
    const logged = (hours.loggedMinutes / 60).toFixed(1);
    const target = (hours.targetMinutes / 60).toFixed(1);
    lines.push(`Logged ${logged} of ${target} required ${KIND_LABELS[kind].toLowerCase()} hours this week.`, "");
  }
  lines.push("Please reply if anything got in the way.", "", "Thanks");

  return {
    id: kind,
    label: `Email ${input.menteeFirstName} about this`,
    to: input.menteeEmail ?? "",
    cc: kind === "front_desk" ? FRONT_DESK_FOLLOW_UP_CC : STUDY_FOLLOW_UP_CC,
    subject: `${weekLabel(input)} — ${KIND_LABELS[kind].toLowerCase()}`,
    body: lines.join("\n"),
    href: null,
  };
}

function wahfDraft(input: BuildFollowUpDraftsInput): FollowUpDraft | null {
  if (input.wahf.status !== "missing") return null;
  const due = input.wahf.dueAt
    ? `${shortDate(new Date(input.wahf.dueAt), true)}, ${time12(new Date(input.wahf.dueAt))}`
    : "the deadline";
  const body = [
    `Hi ${input.menteeFirstName},`,
    "",
    `Checking in about ${weekLabel(input)}.`,
    "",
    `Your WAHF for this week was due ${due} and has not been submitted.`,
    "",
    "Please submit it as soon as you can.",
    "",
    "Thanks",
  ].join("\n");
  return {
    id: "wahf",
    label: `Email ${input.menteeFirstName} about this`,
    to: input.menteeEmail ?? "",
    // No CC until a WAHF recipient is configured.
    cc: null,
    subject: `${weekLabel(input)} — WAHF`,
    body,
    href: null,
  };
}

function withHref(draft: FollowUpDraft, menteeEmail: string | null): FollowUpDraft {
  if (!menteeEmail) return { ...draft, href: null };
  const params = [`subject=${encodeURIComponent(draft.subject)}`];
  if (draft.cc) params.push(`cc=${encodeURIComponent(draft.cc)}`);
  params.push(`body=${encodeURIComponent(draft.body)}`);
  return { ...draft, to: menteeEmail, href: `mailto:${menteeEmail}?${params.join("&")}` };
}

/**
 * All follow-up drafts for one selected week, in fixed order (front desk,
 * study, WAHF). Returns [] when nothing warrants a follow-up. When the scholar
 * has no email the drafts are still returned with `href: null` so the caller
 * can render them disabled (launch unavailable).
 */
export function buildFollowUpDrafts(input: BuildFollowUpDraftsInput): FollowUpDraft[] {
  const drafts: FollowUpDraft[] = [];
  for (const kind of ["front_desk", "study_session"] as const) {
    const hours = input.hours.find((bucket) => bucket.kind === kind);
    if (!hours) continue;
    const draft = hoursDraft(kind, hours, input);
    if (draft) drafts.push(draft);
  }
  const wahf = wahfDraft(input);
  if (wahf) drafts.push(wahf);
  return drafts.map((draft) => withHref(draft, input.menteeEmail));
}
