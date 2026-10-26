"use client"

import { format } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { WahfRow } from "@/lib/types/supabase"
import { wahfGradeEntries } from "./utils"

export function RecentGradesCard({ submission }: { submission: WahfRow | null }) {
  const grades = wahfGradeEntries(submission)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent grades</CardTitle>
        <p className="text-sm text-muted-foreground">
          {submission
            ? `From the latest WAHF with grades, submitted ${format(new Date(submission.created_at), "MMM d, yyyy")}. Independent of the selected week.`
            : "No grades reported in this scholar’s WAHF submissions yet."}
        </p>
      </CardHeader>
      {grades.length > 0 && (
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Grades from the latest WAHF submission with reported grades</caption>
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th scope="col" className="py-2 pr-4 font-medium">Course</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Assignment or assessment</th>
                  <th scope="col" className="py-2 font-medium">Grade</th>
                </tr>
              </thead>
              <tbody>
                {grades.map(({ course, assessment, grade }) => (
                  <tr key={JSON.stringify([course, assessment])} className="border-b last:border-0">
                    <th scope="row" className="py-3 pr-4 font-medium">{course}</th>
                    <td className="py-3 pr-4">{assessment}</td>
                    <td className="py-3 font-semibold">{grade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
