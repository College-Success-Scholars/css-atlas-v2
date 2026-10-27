import { redirect } from "next/navigation";
import { isDeveloperProfile } from "@/lib/auth";
import { getCurrentUser } from "@/lib/server/queries";

/**
 * Hours Benchmark is developer-only (real profile, not acting-as overlay).
 */
export default async function HoursBenchmarkLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getCurrentUser();
  if (!isDeveloperProfile(me?.realProfile ?? me?.profile ?? null)) {
    redirect("/dashboard");
  }
  return children;
}
