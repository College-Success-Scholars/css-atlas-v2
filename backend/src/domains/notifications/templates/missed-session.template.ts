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
        headline: `${pick(OPENERS, event.occurrenceRef)}: ${first} isn't at ${place} yet`, 
        facts: [when, ...(late > 0 ? [`started about ${late} min ago`] : [])], 
        ask: outside || "Reach out and see what they are up to.", 
        draft: `Hey ${first}, you're on the schedule for ${place} right now. Everything okay? Still time to swing by.` }, `${first} isn't at ${place} yet (${when})`);
  }
  const day = dayLabel(event.scheduledStart), email = teamEmail(event.sessionKind);
  return toNotification({ 
    headline: `${first}'s ${shift} came and went without a sign-in`, 
    facts: [day, when], 
    ask: outside ? `${outside} It may just need an hours fix. Ask them to email ${email}.` : `If there's a reason, ask them to email ${email} so it can be excused.`, 
    draft: `Hey ${first}, I noticed you weren't at your ${shift} on ${day} (${when}). Everything okay? If something came up, email ${email} so the team can sort it out.`, 
    note: fallbackNote(reason, first), url: scholarUrl(event.scholarId) }, `${first}'s ${shift} on ${day} (${when}) has no sign-in`);
}
