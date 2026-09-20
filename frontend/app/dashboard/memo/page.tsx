import { Suspense } from "react"

import { WeeklyMemoAsyncContent } from "./_components/weekly-memo-async-content"
import { WeeklyMemoDataSkeleton } from "./_components/weekly-memo-data-skeleton"
import { WeeklyMemoHeaderShell } from "./_components/weekly-memo-header-shell"
import { WeeklyMemoNavProvider } from "./_components/weekly-memo-nav-context"

export const dynamic = "force-dynamic"

type PageProps = {
  searchParams: Promise<{ week?: string }>
}

export default async function WeeklyMemoPage({ searchParams }: PageProps) {
  // Access redirect: app/dashboard/memo/layout.tsx
  const { week } = await searchParams

  return (
    <WeeklyMemoNavProvider key={week ?? "current"}>
      <main className="space-y-4 pb-4">
        <WeeklyMemoHeaderShell weekParam={week} />
        <Suspense key={week ?? "current"} fallback={<WeeklyMemoDataSkeleton />}>
          <WeeklyMemoAsyncContent weekParam={week} />
        </Suspense>
      </main>
    </WeeklyMemoNavProvider>
  )
}
