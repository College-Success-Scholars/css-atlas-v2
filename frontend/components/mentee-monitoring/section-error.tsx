"use client"

import { AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface SectionErrorProps {
  title: string
  message: string
  retriable: boolean
  onRetry: () => void
  pending?: boolean
}

/** Inline failure for one section; other sections stay usable. */
export function SectionError({ title, message, retriable, onRetry, pending }: SectionErrorProps) {
  return (
    <Card className="h-full min-w-0 gap-0 py-0 shadow-none" role="alert" aria-label={`${title} failed to load`}>
      <CardContent className="space-y-3 px-[18px] py-4">
        <p className="text-[15px] font-semibold">{title}</p>
        <p className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{message}</span>
        </p>
        {retriable && (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={pending}
            onClick={onRetry}
          >
            Retry
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
