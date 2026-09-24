import type { NotificationEvent, RecipientReason, RenderedNotification } from "../notification.types.js";
import { dayLabel, fallbackNote, firstName, pick, scholarUrl, teamEmail, timeOf, timeRange, toNotification } from "./format.js";

const OPENERS = ["Heads up"] as const;
export function renderMissedSessionMessage(event: NotificationEvent, scholarName: string, reason?: RecipientReason): RenderedNotification {
  const first = firstName(scholarName), isFrontDesk = event.sessionKind === "front_desk";
  const place = isFrontDesk ? "the front desk" : "study session", shift = isFrontDesk ? "front desk shift" : "study session";
  const when = timeRange(event.scheduledStart, event.scheduledEnd), outside = event.unmatchedEntryAt ? `They did sign in at ${timeOf(event.unmatchedEntryAt)}, but it landed outside the scheduled time.` : "";
  if (event.phase !== "ended") {
    const late = Math.round((event.minutesLate ?? 0) / 5) * 5;
    return toNotification({ 
        headline: `${first} hasn't shown up to ${place} yet`, 
        facts: [when, ...(late > 0 ? [`about ${late} in`] : [])], 
        ask: outside || "Worth a quick check-in." }, `${first} isn't at ${place} yet (${when})`);
  }
  const day = dayLabel(event.scheduledStart), email = teamEmail(event.sessionKind);
  return toNotification({ 
    headline: `${first} missed ${shift} today`, 
    facts: [day, when], 
    ask: outside ? `${outside} It may just need an hours fix. Ask them to email ${email}.` : `If there's a reason, ask them to email ${email} so it can be excused.`, 
    note: fallbackNote(reason, first), 
    url: scholarUrl(event.scholarId) }, `${first}'s ${shift} on ${day} (${when}) has no sign-in`);
}
