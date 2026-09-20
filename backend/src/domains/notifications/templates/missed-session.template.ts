import type { NotificationEvent, RenderedNotification } from "../notification.types.js";

export function renderMissedSessionMessage(
  event: NotificationEvent,
  scholarName: string
): RenderedNotification {
  const kind = event.sessionKind === "front_desk" ? "front-desk shift" : "study session";
  return { text: `${scholarName} has not signed in for their scheduled ${kind}. Please check in with them.` };
}
