"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export function RoomPageToolbar({ lastUpdatedLabel }: { lastUpdatedLabel: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const refresh = () => {
    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="inline-flex items-center gap-1.5 text-foreground">
          <span className="size-2 rounded-full bg-muted-foreground" aria-hidden />
          Snapshot
        </span>
        <span className="text-muted-foreground">
          Last updated: {lastUpdatedLabel}
        </span>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={refresh}
        disabled={isPending}
      >
        <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
        {isPending ? "Refreshing…" : "Refresh"}
      </Button>
    </div>
  )
}
