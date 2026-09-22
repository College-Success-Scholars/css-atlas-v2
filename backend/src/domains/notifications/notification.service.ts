import { getSupabaseServiceRoleClient } from "../../supabase/client.js";
import { SlackChannel } from "./channels/slack-channel.js";
import type { NotificationChannel } from "./channels/channel.interface.js";
import { resolveTeamLeaderRecipient } from "./recipient-resolver.js";
import { renderIncompleteSessionMessage } from "./templates/incomplete-session.template.js";
import { renderMissedSessionMessage } from "./templates/missed-session.template.js";
import type { NotificationEvent, NotificationOutcome, RenderedNotification } from "./notification.types.js";

function idempotencyKey(event: NotificationEvent, recipientId: string): string {
  return `${event.type}:${event.occurrenceRef}:${recipientId}:slack`;
}

function render(event: NotificationEvent, scholarName: string): RenderedNotification {
  return event.type.startsWith("incomplete_")
    ? renderIncompleteSessionMessage(event, scholarName)
    : renderMissedSessionMessage(event, scholarName);
}

async function fetchScholarName(scholarId: string): Promise<string> {
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("user_roster")
    .select("first_name, last_name")
    .eq("uid", scholarId)
    .maybeSingle();
  if (error) throw error;
  return [data?.first_name, data?.last_name].filter(Boolean).join(" ").trim() || scholarId;
}

export async function emitNotificationEvent(
  event: NotificationEvent,
  channel: NotificationChannel = new SlackChannel()
): Promise<NotificationOutcome | null> {
  const recipient = await resolveTeamLeaderRecipient(event.scholarId);
  if (!recipient) return null;
  const supabase = getSupabaseServiceRoleClient();
  const key = idempotencyKey(event, recipient.id);
  const { data: existing, error: lookupError } = await supabase
    .from("notification_log")
    .select("status")
    .eq("idempotency_key", key)
    .eq("status", "sent")
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return { status: "sent", error: null, attemptCount: 0 };

  const message = render(event, await fetchScholarName(event.scholarId));
  const target = recipient.slackUserId ?? "missing";
  const delivery = recipient.slackUserId
    ? await channel.send(recipient.slackUserId, message)
    : { ok: false, attempts: 0, error: "Recipient has no Slack user ID" };
  const outcome: NotificationOutcome = delivery.ok
    ? { status: "sent", error: null, attemptCount: delivery.attempts }
    : {
        status: recipient.slackUserId ? "failed" : "skipped_missing_slack_id",
        error: delivery.error,
        attemptCount: delivery.attempts,
      };
  const { error: insertError } = await supabase.from("notification_log").insert({
    event_type: event.type,
    event_ref_id: event.occurrenceRef,
    recipient_id: recipient.id,
    channel: channel.name,
    channel_target: target,
    payload: { event, message },
    status: outcome.status,
    error: outcome.error,
    attempt_count: outcome.attemptCount,
    idempotency_key: key,
    sent_at: outcome.status === "sent" ? new Date().toISOString() : null,
  });
  if (insertError && insertError.code !== "23505") throw insertError;
  return outcome;
}
