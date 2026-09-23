import type { RecipientReason, RenderedNotification } from "../notification.types.js";

const TZ = "America/New_York";
export const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const firstName = (full: string) => esc(full.split(" ")[0] ?? full);
export function pick<T>(items: readonly T[], seed: string): T {
  let hash = 0;
  for (const character of seed) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return items[hash % items.length]!;
}
function parts(iso: string) {
  const values = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true }).formatToParts(new Date(iso));
  const get = (type: string) => values.find((part) => part.type === type)?.value ?? "";
  const minute = get("minute");
  return { time: minute === "00" ? get("hour") : `${get("hour")}:${minute}`, ampm: get("dayPeriod").toUpperCase() };
}
export function timeOf(iso: string): string { const time = parts(iso); return `${time.time} ${time.ampm}`; }
export function timeRange(start: string, end: string): string {
  const first = parts(start), last = parts(end);
  return first.ampm === last.ampm ? `${first.time}-${last.time} ${last.ampm}` : `${first.time} ${first.ampm}-${last.time} ${last.ampm}`;
}
export function dayLabel(iso: string): string {
  const values = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" }).formatToParts(new Date(iso));
  const get = (type: string) => values.find((part) => part.type === type)?.value ?? "";
  return `${get("weekday")}, ${get("month")} ${get("day")}`;
}
export const teamEmail = (kind: string) => kind === "front_desk" ? process.env.FD_TEAM_EMAIL ?? "cssfd@umd.edu" : process.env.SS_TEAM_EMAIL ?? "css_ss@umd.edu";
export const scholarUrl = (id: string) => process.env.APP_BASE_URL ? `${process.env.APP_BASE_URL.replace(/\/$/, "")}/mentees/${encodeURIComponent(id)}` : undefined;
export function fallbackNote(reason: RecipientReason | undefined, first: string): string | undefined {
  if (reason === "fallback_no_mentor") return `_You're getting this because ${first} doesn't have a mentor assigned._`;
  if (reason === "fallback_multiple_mentors") return `_You're getting this because ${first} has more than one mentor on file._`;
  if (reason === "fallback_no_slack_id") return `_You're getting this because ${first}'s mentor isn't linked to Slack yet._`;
  return undefined;
}
export function toNotification(message: { headline: string; facts: string[]; ask: string; draft: string; note?: string; url?: string }, text: string): RenderedNotification {
  return { text, blocks: [
    { type: "section", text: { type: "mrkdwn", text: [`*${message.headline}*`, message.facts.join(" · "), message.ask].filter(Boolean).join("\n") } },
    { type: "section", text: { type: "mrkdwn", text: `> ${message.draft}` } },
    ...(message.note ? [{ type: "context", elements: [{ type: "mrkdwn", text: message.note }] }] : []),
    ...(message.url ? [{ type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Open in Atlas" }, url: message.url }] }] : []),
  ] };
}
