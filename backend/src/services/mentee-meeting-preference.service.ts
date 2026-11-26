/**
 * @file mentee-meeting-preference.service.ts
 * @module backend/services
 *
 * Read/upsert for the per-pair TL<->mentee meeting preference. The owner is
 * always the authenticated profile id passed by the controller (never a
 * request-body id), and every write re-checks an active mentor_mentee
 * assignment so a reassignment revokes access. RLS is the second enforcement
 * layer (see the mentee_meeting_preferences migration).
 *
 * ## Responsibilities
 * - Read the caller's own preference for one mentee
 * - Atomically upsert both fields for the caller's own active pair
 *
 * ## What does NOT belong here
 * - HTTP request/response logic
 * - Roster-wide reads (mentee.service)
 * - MCF prefill (task 6.x)
 */
import { getSupabaseClient } from "../supabase/client.js";
import type {
  MeetingPreferenceOutput,
  MeetingPreferenceRow,
} from "../models/meeting-preference.model.js";

// The generated database types predate this live table (regenerate after the
// migration is applied: npm run db:types --prefix backend).
interface UntypedResult {
  data: unknown;
  error: unknown;
}
interface Chain {
  select: (columns: string) => Chain;
  eq: (column: string, value: unknown) => Chain;
  upsert: (values: Record<string, unknown>, options?: { onConflict?: string }) => Chain;
  maybeSingle: () => Promise<UntypedResult>;
  single: () => Promise<UntypedResult>;
}
interface UntypedClient {
  from: (table: string) => Chain;
}

export function toMeetingPreferenceOutput(row: MeetingPreferenceRow): MeetingPreferenceOutput {
  return { weekday: Number(row.weekday), meetingTime: String(row.meeting_time).slice(0, 5) };
}

export type SaveMeetingPreferenceResult =
  | { ok: true; data: MeetingPreferenceOutput }
  | { ok: false; error: { code: "not_assigned" | "save_failed"; message: string } };

/** Re-checked on every write: the caller must currently mentor this mentee. */
export async function isMenteeAssignedToMentor(
  mentorId: string,
  menteeUid: string
): Promise<boolean> {
  const supabase = getSupabaseClient() as unknown as UntypedClient;
  const { data, error } = await supabase
    .from("mentor_mentee")
    .select("mentee_uid")
    .eq("mentor_id", mentorId)
    .eq("mentee_uid", menteeUid)
    .maybeSingle();
  if (error) throw error;
  return data != null;
}

/** The caller's own preference for one mentee, or null when unset. */
export async function getMeetingPreference(
  mentorId: string,
  menteeUid: string
): Promise<MeetingPreferenceOutput | null> {
  const supabase = getSupabaseClient() as unknown as UntypedClient;
  const { data, error } = await supabase
    .from("mentee_meeting_preferences")
    .select("mentor_id, mentee_uid, weekday, meeting_time, created_at, updated_at")
    .eq("mentor_id", mentorId)
    .eq("mentee_uid", menteeUid)
    .maybeSingle();
  if (error) throw error;
  return data ? toMeetingPreferenceOutput(data as MeetingPreferenceRow) : null;
}

/**
 * Atomically upsert the caller's own preference for one active pair. `mentorId`
 * is the authenticated profile id; both fields are written together.
 */
export async function saveMeetingPreference(params: {
  mentorId: string;
  menteeUid: string;
  weekday: number;
  meetingTime: string;
}): Promise<SaveMeetingPreferenceResult> {
  const assigned = await isMenteeAssignedToMentor(params.mentorId, params.menteeUid);
  if (!assigned) {
    return {
      ok: false,
      error: { code: "not_assigned", message: "You are not assigned to this mentee." },
    };
  }

  const supabase = getSupabaseClient() as unknown as UntypedClient;
  const { data, error } = await supabase
    .from("mentee_meeting_preferences")
    .upsert(
      {
        mentor_id: params.mentorId,
        mentee_uid: params.menteeUid,
        weekday: params.weekday,
        meeting_time: `${params.meetingTime}:00`,
      },
      { onConflict: "mentor_id,mentee_uid" }
    )
    .select("mentor_id, mentee_uid, weekday, meeting_time, created_at, updated_at")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: {
        code: "save_failed",
        message: "Could not save the meeting preference. Your previous setting was preserved.",
      },
    };
  }
  return { ok: true, data: toMeetingPreferenceOutput(data as MeetingPreferenceRow) };
}
