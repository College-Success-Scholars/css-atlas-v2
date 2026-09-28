import { Suspense } from "react";
import { dateToCampusWeek } from "@/lib/format/time";
import { campusWeekNumbers } from "@/lib/format/campus-week";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { YearNotStartedState } from "@/components/dashboard/widgets/year-not-started-state";
import { CampusWeekUrlNav, CAMPUS_WEEK_NAV_WIDTH_CLASS } from "@/components/data-display/campus-week-nav";

const DESCRIPTION =
  "Campus week from lib/time. Weeks run through the current week plus one.";

export type CampusWeekCardProps = {
  /** Base path for week links, e.g. "/dev/traffic" or "/dev/session-records". */
  basePath: string;
  /** Extra query params to include in every week link (e.g. { increment: "15" }). */
  additionalSearchParams?: Record<string, string>;
  /** Currently selected week (highlighted). Omit to not highlight. */
  selectedWeek?: number | null;
};

export function CampusWeekCard({
  basePath,
  additionalSearchParams,
  selectedWeek,
}: CampusWeekCardProps) {
  const currentCampusWeek = dateToCampusWeek(new Date());
  const yearStarted = currentCampusWeek != null;
  const weeks = campusWeekNumbers(yearStarted ? currentCampusWeek + 1 : null);

  return (
    <Card className="relative">
      <div className="absolute right-6 top-6 flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Current campus week:</span>
        <Badge variant="secondary">{currentCampusWeek ?? "—"}</Badge>
      </div>
      <CardHeader>
        <CardTitle>Time</CardTitle>
        <CardDescription>{DESCRIPTION}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!yearStarted ? (
          <YearNotStartedState variant="compact" />
        ) : (
          <Suspense fallback={<Skeleton className={`h-9 ${CAMPUS_WEEK_NAV_WIDTH_CLASS}`} />}>
            <CampusWeekUrlNav
              basePath={basePath}
              searchParams={additionalSearchParams}
              weeks={weeks}
              selectedWeek={selectedWeek ?? null}
              currentCampusWeek={currentCampusWeek}
            />
          </Suspense>
        )}
      </CardContent>
    </Card>
  );
}
