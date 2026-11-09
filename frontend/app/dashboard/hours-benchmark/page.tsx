import { getHoursBenchmarkReport } from "@/lib/server/data";

import { HoursBenchmarkReportView } from "./_components/hours-benchmark-report-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Hours Benchmark | CSS Atlas",
  description:
    "Multi-week front desk and study session completion benchmark for College Success Scholars",
};

export default async function HoursBenchmarkPage() {
  const report = await getHoursBenchmarkReport();
  return <HoursBenchmarkReportView report={report} />;
}
