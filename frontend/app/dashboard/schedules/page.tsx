import { redirect } from "next/navigation";
import { canAccessWeeklyMemo } from "@/lib/auth";
import { getCurrentProfile } from "@/lib/server/queries";
import { backendGet } from "@/lib/server/api-client";
import type { ScheduleBoard } from "@/lib/types/schedules";
import { ScheduleManager } from "./schedule-manager";

export const dynamic = "force-dynamic";

export default async function SchedulesPage({ searchParams }: {
  searchParams: Promise<{ week?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!canAccessWeeklyMemo(profile)) redirect("/dashboard");
  const { week } = await searchParams;
  const query = week ? `?week=${encodeURIComponent(week)}` : "";
  try {
    const board = await backendGet<ScheduleBoard>(`/api/schedules${query}`);
    return <ScheduleManager key={board.weekStart} initialBoard={board} />;
  } catch (error) {
    return <div className="p-6"><h1 className="text-2xl font-semibold">Scholar schedules</h1>
      <p role="alert" className="mt-4">{error instanceof Error ? error.message : "Could not load schedules."}</p>
    </div>;
  }
}
