import { Clock3 } from "lucide-react"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { RecentFormSubmission } from "@css-atlas/shared/contracts/form-logs"
import { PersonalActivityLogClient } from "./personal-activity-log-client"

export function PersonalActivityLog({
  entries,
}: {
  entries: readonly RecentFormSubmission[]
}) {
  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5 pb-0 pt-0">
        <CardTitle className="flex items-center gap-2 text-xl font-semibold">
          <Clock3 className="h-5 w-5 text-muted-foreground" />
          Activity log
        </CardTitle>
        <CardDescription>
          Recent WHAF, WPL, and MCF submissions
        </CardDescription>
      </CardHeader>
      <div className="space-y-4 px-5 pb-1 pt-0">
        <PersonalActivityLogClient entries={entries} />
      </div>
    </Card>
  )
}
