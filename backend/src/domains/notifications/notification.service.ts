import { getSupabaseServiceRoleClient } from "../../supabase/client.js";
import { SlackChannel } from "./channels/slack-channel.js";
import type { NotificationChannel } from "./channels/channel.interface.js";
import { resolveTeamLeaderRecipient } from "./recipient-resolver.js";
import { renderIncompleteSessionMessage } from "./templates/incomplete-session.template.js";
import { renderMissedSessionMessage } from "./templates/missed-session.template.js";
import type { NotificationEvent, NotificationOutcome, NotificationRecipient, RenderedNotification } from "./notification.types.js";

export function idempotencyKey(event: NotificationEvent, recipientId: string): string {
  const phase = event.phase === "ended" ? ":ended" : "";
  return `${event.type}:${event.occurrenceRef}${phase}:${recipientId}:slack`;
}

function render(event: NotificationEvent, scholarName: string, recipient: NotificationRecipient): RenderedNotification {
  return event.type.startsWith("incomplete_")
    ? renderIncompleteSessionMessage(event, scholarName, recipient.reason)
    : renderMissedSessionMessage(event, scholarName, recipient.reason);
}

async function fetchScholarName(scholarId: string): Promise<string> {
  const { data, error } = await getSupabaseServiceRoleClient().from("user_roster")
    .select("first_name, last_name").eq("uid", scholarId).maybeSingle();
  if (error) throw error;
  return [data?.first_name, data?.last_name].filter(Boolean).join(" ").trim() || scholarId;
}

export async function emitNotificationEvent(event: NotificationEvent, channel: NotificationChannel = new SlackChannel()): Promise<NotificationOutcome | null> {
  const recipient = await resolveTeamLeaderRecipient(event.scholarId);
  if (!recipient) return null;
  const supabase = getSupabaseServiceRoleClient();
  const key = idempotencyKey(event, recipient.id);
  const { data: existing, error: lookupError } = await supabase.from("notification_log")
    .select("id, status, attempt_count").eq("idempotency_key", key).maybeSingle();
  if (lookupError) throw lookupError;
  if (existing?.status === "sent") return { status: "skipped_duplicate", error: null, attemptCount: 0 };
  if (existing?.status === "skipped_missing_slack_id" && !recipient.slackUserId) {
    return { status: "skipped_missing_slack_id", error: "Recipient has no Slack user ID", attemptCount: 0 };
  }

  const message = render(event, await fetchScholarName(event.scholarId), recipient);
  const target = recipient.slackUserId ?? "missing";
  const delivery = recipient.slackUserId
    ? await channel.send(recipient.slackUserId, message)
    : { ok: false, attempts: 0, error: "Recipient has no Slack user ID" };
  const outcome: NotificationOutcome = delivery.ok
    ? { status: "sent", error: null, attemptCount: delivery.attempts }
    : { status: recipient.slackUserId ? "failed" : "skipped_missing_slack_id", error: delivery.error, attemptCount: delivery.attempts };
  const row = {
    event_type: event.type, event_ref_id: event.occurrenceRef, recipient_id: recipient.id,
    channel: channel.name, channel_target: target, payload: { event, message }, status: outcome.status,
    error: outcome.error, attempt_count: (existing?.attempt_count ?? 0) + outcome.attemptCount,
    idempotency_key: key, sent_at: outcome.status === "sent" ? new Date().toISOString() : null,
  };
  const { error: writeError } = existing
    ? await supabase.from("notification_log").update(row).eq("id", existing.id).neq("status", "sent")
    : await supabase.from("notification_log").insert(row);
  if (writeError && writeError.code !== "23505") throw writeError;
  return outcome;
}
