import { getSupabaseServiceRoleClient } from "../../supabase/client.js";
import type { NotificationRecipient } from "./notification.types.js";

interface MentorRelationRow {
  profiles: { id: string; slack_user_id: string | null; full_name: string | null } | null;
}

export async function resolveTeamLeaderRecipient(scholarId: string): Promise<NotificationRecipient | null> {
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("mentor_mentee")
    .select("profiles!mentor_mentee_mentor_id_fkey(id, slack_user_id, full_name)")
    .eq("mentee_uid", scholarId);
  if (error) throw error;
  const relations = (data ?? []) as unknown as MentorRelationRow[];
  const recipients = relations.flatMap((relation) => relation.profiles ? [relation.profiles] : []);
  if (recipients.length !== 1) return null;
  const recipient = recipients[0]!;
  return { id: recipient.id, slackUserId: recipient.slack_user_id, name: recipient.full_name };
}
