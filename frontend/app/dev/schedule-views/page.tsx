import Link from "next/link";
import { dateToCampusWeek } from "@/lib/format/time";
import { backendGet } from "@/lib/server/api-client";
import { CampusWeekCard } from "@/components/data-display/campus-week-card";
import { ScheduleViewsClient } from "./schedule-views-client";
import type { ScheduleBoardResponse } from "./types";

export const metadata = {
  title: "FD/SS Schedule Views | Dev Tools",
  description:
    "Weekly and daily Front Desk / Study Session schedule boards from live roster and shift assignments (read-only).",
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ week?: string }>;
};

export default async function DevScheduleViewsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const currentCampusWeek = dateToCampusWeek(new Date());
  const weekNum =
    params.week != null && params.week !== ""
      ? Math.max(1, Math.min(30, parseInt(params.week, 10) || 1))
      : currentCampusWeek != null
        ? Math.max(1, Math.min(30, currentCampusWeek))
        : 1;

  const board = await backendGet<ScheduleBoardResponse>(
    "/api/dev/schedule-board",
  );

  return (
    <div className="container mx-auto max-w-6xl space-y-8 py-12">
      <div className="flex items-center gap-4">
        <Link
          href="/dev"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← Dev Tools
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">FD/SS Schedule Views</h1>
        <p className="text-muted-foreground mt-1">
          Weekly people×days and daily timeline boards for Front Desk / Study
          Session shifts. Eligible freshmen and sophomores only (required minutes
          &gt; 0). Live roster + standing assignments from{" "}
          <code className="text-xs">scholar_shift_assignments</code>. Boards are
          read-only; Publish / add are stubbed for later.
        </p>
      </div>

      <CampusWeekCard
        basePath="/dev/schedule-views"
        selectedWeek={weekNum}
      />

      <ScheduleViewsClient weekNum={weekNum} scholars={board.scholars} />
    </div>
  );
}
