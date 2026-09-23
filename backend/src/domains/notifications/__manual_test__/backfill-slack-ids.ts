import "dotenv/config";
import { getSupabaseServiceRoleClient } from "../../../supabase/client.js";

async function lookup(email: string): Promise<string | null> {
  const response = await fetch(`https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`, {
    headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
  });
  const body = await response.json() as { ok: boolean; user?: { id: string } };
  return body.ok && body.user ? body.user.id : null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase.from("profiles").select("id, full_name, emails").is("slack_user_id", null);
  if (error) throw error;
  let found = 0;
  const missing: string[] = [];
  for (const profile of data ?? []) {
    let slackId: string | null = null;
    for (const email of (profile.emails as string[] | null) ?? []) {
      slackId = await lookup(email);
      if (slackId) break;
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
    if (!slackId) { missing.push(profile.full_name ?? profile.id); continue; }
    found += 1;
    if (apply) {
      const { error: updateError } = await supabase.from("profiles").update({ slack_user_id: slackId }).eq("id", profile.id);
      if (updateError) throw updateError;
    }
  }
  console.info({ candidates: data?.length ?? 0, found, applied: apply, missing });
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
