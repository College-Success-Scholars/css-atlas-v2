import type { NotificationEvent, RecipientReason, RenderedNotification } from "../notification.types.js";
import { dayLabel, fallbackNote, firstName, scholarUrl, teamEmail, timeOf, timeRange, toNotification } from "./format.js";

export function renderIncompleteSessionMessage(event: NotificationEvent, scholarName: string, reason?: RecipientReason): RenderedNotification {
  const first = firstName(scholarName), shift = event.sessionKind === "front_desk" ? "front desk shift" : "study session";
  const when = timeRange(event.scheduledStart, event.scheduledEnd), day = dayLabel(event.scheduledStart), email = teamEmail(event.sessionKind), signedIn = event.entryAt ? timeOf(event.entryAt) : undefined;
  // An unmatched entry earns no minutes under the compliance calculation.
  return toNotification({ headline: signedIn ? `${first} signed in at ${signedIn} but never signed out` : `${first} signed in but never signed out`, facts: [day, `${shift} ${when}`], ask: `This shift won't count toward their hours until it's fixed. Ask ${first} to email ${email} with when they left.`, draft: `Hey ${first}, looks like you signed in for your ${when} ${shift} on ${day} but didn't sign out. Can you email ${email} with when you left so we can fix your hours?`, note: fallbackNote(reason, first), url: scholarUrl(event.scholarId) }, `${first} signed in on ${day} (${when}) but has no sign-out`);
}
