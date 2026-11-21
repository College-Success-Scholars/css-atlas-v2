import { redirect } from "next/navigation";
import { PersonalClient } from "@/components/personal/personal-client";
import { canAccessWeeklyMemo } from "@/lib/auth";
import { getCurrentProfile, getMyMentees } from "@/lib/server/queries";
import { backendPost } from "@/lib/server/api-client";
import { dateToCampusWeek } from "@/lib/format/time";
import { WahfFormLogRow, McfFormLogRow, WplFormLogRow } from "@/lib/types/form-log";
import { ProfileRow } from "@/lib/types/supabase";

export default async function PersonalPage() {
  const profile = await getCurrentProfile();

  // Personal monitoring is team_leader+ (same effective-role gate as Memo).
  if (!canAccessWeeklyMemo(profile)) {
    redirect("/dashboard");
  }

  const uid = String((profile as Record<string, unknown>).student_id ?? "");
  const uids = uid ? [uid] : [];

  const [wahf, mcf, wpl, mentees] = await Promise.all([
    uids.length ? backendPost<WahfFormLogRow[]>("/api/form-logs/whaf/by-uids", { uids }) : Promise.resolve([]),
    uids.length ? backendPost<McfFormLogRow[]>("/api/form-logs/mcf/by-uids", { uids, field: "mentor_uid" }) : Promise.resolve([]),
    uids.length ? backendPost<WplFormLogRow[]>("/api/form-logs/wpl/by-uids", { uids }) : Promise.resolve([]),
    getMyMentees(),
  ]);

  const currentCampusWeek = dateToCampusWeek(new Date());

  return (
    <div className="space-y-6">
      <PersonalClient
        profile={profile as ProfileRow}
        wahf={wahf as WahfFormLogRow[]}
        mcf={mcf as McfFormLogRow[]}
        wpl={wpl as WplFormLogRow[]}
        mentees={mentees}
        currentCampusWeek={currentCampusWeek}
      />
    </div>
  );
}
