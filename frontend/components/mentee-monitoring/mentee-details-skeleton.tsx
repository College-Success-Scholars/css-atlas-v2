import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function MenteeDetailsSkeleton() {
  return (
    <div role="status" aria-label="Loading mentee details" className="space-y-4">
      <span className="sr-only">Loading mentee details…</span>
      <div aria-hidden="true" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Card key={index}>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="space-y-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
