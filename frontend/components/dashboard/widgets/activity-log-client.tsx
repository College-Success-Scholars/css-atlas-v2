"use client";

import { CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RecentFormSubmission } from "@css-atlas/shared/contracts/form-logs";
import { toScholarHomeActivityEntries } from "@/lib/dashboard/scholar-home-activity";

function formatSubmittedAt(value: string | null): string {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function ActivityLogClient({ entries }: { entries: readonly RecentFormSubmission[] }) {
  const visibleEntries = toScholarHomeActivityEntries(entries);

  return (
    <CardContent className="space-y-4">
      {visibleEntries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No WAHF submissions found.</p>
      ) : (
        <div className="space-y-3">
          {visibleEntries.map((entry) => (
            <div key={entry.id} className="rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="secondary">{entry.formType}</Badge>
                <p className="text-sm text-muted-foreground">
                  Submitted: {formatSubmittedAt(entry.submittedAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </CardContent>
  );
}
