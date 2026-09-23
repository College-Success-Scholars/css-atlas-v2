import { getSupabaseServiceRoleClient } from "../../supabase/client.js";
import type { NotificationRecipient, RecipientReason } from "./notification.types.js";

interface ProfileRow { id: string; slack_user_id: string | null; full_name: string | null }
interface MentorRelationRow { profiles: ProfileRow | null }

const toRecipient = (profile: ProfileRow, reason: RecipientReason): NotificationRecipient =>
  ({ id: profile.id, slackUserId: profile.slack_user_id, name: profile.full_name, reason });

async function fallbackRecipient(reason: RecipientReason): Promise<NotificationRecipient | null> {
  const id = process.env.NOTIFICATION_FALLBACK_PROFILE_ID;
  if (!id) return null;
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("profiles").select("id, slack_user_id, full_name").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toRecipient(data as ProfileRow, reason) : null;
}

export async function resolveTeamLeaderRecipient(scholarId: string): Promise<NotificationRecipient | null> {
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("mentor_mentee")
    .select("profiles!mentor_mentee_mentor_id_fkey(id, slack_user_id, full_name)")
    .eq("mentee_uid", scholarId);
  if (error) throw error;
  const mentors = ((data ?? []) as unknown as MentorRelationRow[])
    .flatMap((relation) => relation.profiles ? [relation.profiles] : []);
  if (mentors.length !== 1) {
    return fallbackRecipient(mentors.length === 0 ? "fallback_no_mentor" : "fallback_multiple_mentors");
  }
  const mentor = mentors[0]!;
  return mentor.slack_user_id
    ? toRecipient(mentor, "mentor")
    : (await fallbackRecipient("fallback_no_slack_id")) ?? toRecipient(mentor, "mentor");
}
