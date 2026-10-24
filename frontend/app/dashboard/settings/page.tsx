import { cookies } from "next/headers";
import { getCurrentProfile, getMyMentees } from "@/lib/server/queries";
import { fetchAllUsersForMemo } from "@/lib/server/data";
import SettingsClient, { type MenteeCandidate } from "@/components/settings/settings-client";
import type { ProfileRow, MenteeRow } from "@/lib/types/supabase";
import { DEV_ACTIVE_PROFILE_COOKIE, hasRoleAtLeast } from "../../../../shared/dist/auth.js";

export default async function SettingsPage() {
  const [profile, mentees, users, cookieStore] = await Promise.all([
    getCurrentProfile(),
    getMyMentees(),
    fetchAllUsersForMemo(),
    cookies(),
  ]);

  const currentProfile = profile as ProfileRow;
  const currentMentees = mentees as MenteeRow[];

  const isActingAsTestProfile = Boolean(
    cookieStore.get(DEV_ACTIVE_PROFILE_COOKIE)?.value,
  );
  const canManageMentees =
    !isActingAsTestProfile &&
    hasRoleAtLeast(currentProfile.app_role ?? null, "team_leader");

  const assignedUids = new Set(
    currentMentees.flatMap((mentee) => (mentee.scholar_uid ? [mentee.scholar_uid] : [])),
  );

  const candidates: MenteeCandidate[] = canManageMentees
    ? users
        .filter(
          (user) =>
            !assignedUids.has(user.uid) &&
            (user.status ?? "").toLowerCase() === "enrolled" &&
            (user.program_role ?? "").toLowerCase() === "scholar",
        )
        .map((user) => ({
          uid: user.uid,
          first_name: user.first_name,
          last_name: user.last_name,
        }))
        .sort(
          (a, b) =>
            (a.last_name ?? "").localeCompare(b.last_name ?? "") ||
            (a.first_name ?? "").localeCompare(b.first_name ?? ""),
        )
    : [];

  return (
    <div className="space-y-6">
      <SettingsClient
        profile={currentProfile}
        mentees={currentMentees}
        candidates={candidates}
        canManageMentees={canManageMentees}
        readOnlyReason={
          isActingAsTestProfile
            ? "Read-only while acting as a test profile. Switch to My profile to make changes."
            : null
        }
      />
    </div>
  );
}
