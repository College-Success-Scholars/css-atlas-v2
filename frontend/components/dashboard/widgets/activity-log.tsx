import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock } from "lucide-react"
import type { RecentFormSubmission } from "@css-atlas/shared/contracts/form-logs"
import { ActivityLogClient } from "./activity-log-client"

export function ActivityLog({ entries }: { entries: readonly RecentFormSubmission[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Activity Log
        </CardTitle>
        <CardDescription>
          Your recent WAHF submissions.
        </CardDescription>
      </CardHeader>
      <ActivityLogClient entries={entries} />
    </Card>
  )
}
