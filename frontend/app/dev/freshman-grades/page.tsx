import Link from "next/link";
import { freshmanCohortYear, sophomoreCohortYear } from "@/lib/format/time";
import { backendGet } from "@/lib/server/api-client";
import {
  FreshmanGradesTable,
  type FreshmanGradesReport,
} from "./freshman-grades-table";

export const metadata = {
  title: "Freshman and sophomore grades | Dev Tools",
  description:
    "Temporary FD, SS, and WAHF completion for enrolled freshmen and sophomores through the previous campus week",
};

export const dynamic = "force-dynamic";

export default async function DevFreshmanGradesPage() {
  const report = await backendGet<FreshmanGradesReport>("/api/dev/freshman-grades");
  const { weights } = report;
  const freshmanYear = freshmanCohortYear();
  const sophomoreYear = sophomoreCohortYear();
  const freshmen = {
    ...report,
    scholars: report.scholars.filter((row) => row.cohort === freshmanYear),
  };
  const sophomores = {
    ...report,
    scholars: report.scholars.filter((row) => row.cohort === sophomoreYear),
  };
  const scored = report.scoredWeeks;
  const weekLabel =
    scored != null
      ? scored.fromWeek === scored.throughWeek
        ? `Campus week ${scored.fromWeek}. The current week is ${report.throughWeek}.`
        : `Campus weeks ${scored.fromWeek}–${scored.throughWeek}. The current week is ${report.throughWeek}.`
      : report.throughWeek > 0
        ? `No scored weeks yet. Week 1 is not included, and the current week is ${report.throughWeek}.`
        : "Campus week has not started.";

  return (
    <div className="container mx-auto max-w-6xl space-y-8 py-12">
      <div>
        <Link
          href="/dev"
          className="text-muted-foreground hover:text-foreground text-sm font-medium"
        >
          ← Dev Tools
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Freshman and sophomore grades</h1>
        <p className="text-muted-foreground mt-1">
          Temporary developer view for enrolled freshmen and sophomores who owe hours. {weekLabel}{" "}
          Each week is capped at 100% before the average, so extra hours in one week
          do not make up a missed week. FD is {weights.fd}%, SS is {weights.ss}%,
          and WAHF is {weights.wahf}% of the semester grade. This page does not show
          a semester total. Select a scholar to see the weekly minutes.
        </p>
      </div>

      <FreshmanGradesTable report={freshmen} audience="freshman" />
      <FreshmanGradesTable report={sophomores} audience="sophomore" />
    </div>
  );
}
