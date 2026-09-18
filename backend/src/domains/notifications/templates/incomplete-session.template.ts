import type { NotificationEvent, RenderedNotification } from "../notification.types.js";

export function renderIncompleteSessionMessage(
  event: NotificationEvent,
  scholarName: string
): RenderedNotification {
  const kind = event.sessionKind === "front_desk" ? "front-desk shift" : "study session";
  return { text: `${scholarName} signed in for their ${kind}, but no sign-out is on record. Please confirm the session details.` };
}
