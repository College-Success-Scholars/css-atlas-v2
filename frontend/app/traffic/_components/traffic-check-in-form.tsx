"use client"

import type { RefObject } from "react"
import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Pencil, UserIcon } from "lucide-react"

import { useMinuteNow } from "@/hooks/use-minute-now"
import {
  formatDuration,
  formatLeaveAtClock,
  leaveAtToMaskParts,
  parseLeaveAtMask,
  parseLeaveAtTimeInput,
  sanitizeLeaveAtMaskHour,
  sanitizeLeaveAtMaskMinute,
  type LeaveAtMaskParts,
  validateLeaveAt,
} from "./traffic-format"

export type QuickStayMinutes = 30 | 60 | 90

export type TrafficCheckInFormProps = {
  uid: string
  uidError: string
  uidInputRef: RefObject<HTMLInputElement | null>
  quickStay: QuickStayMinutes | null
  leaveAt: Date
  isSubmitting: boolean
  leaveAtError: string
  onUidChange: (value: string) => void
  onSelectQuickStay: (minutes: QuickStayMinutes) => void
  onLeaveAtTimeChange: (timeHm: string) => void
  onSubmit: () => void
}

export function TrafficCheckInForm({
  uid,
  uidError,
  uidInputRef,
  quickStay,
  leaveAt,
  isSubmitting,
  leaveAtError,
  onUidChange,
  onSelectQuickStay,
  onLeaveAtTimeChange,
  onSubmit,
}: TrafficCheckInFormProps) {
  const now = useMinuteNow()
  const hourInputRef = useRef<HTMLInputElement>(null)
  const minuteInputRef = useRef<HTMLInputElement>(null)
  const [mask, setMask] = useState<LeaveAtMaskParts>(() =>
    leaveAtToMaskParts(leaveAt)
  )
  const [typeError, setTypeError] = useState("")
  const [isEditingTime, setIsEditingTime] = useState(false)

  const maskHm = parseLeaveAtMask(mask)
  const liveLeaveAt =
    isEditingTime && maskHm ? parseLeaveAtTimeInput(maskHm, now) : leaveAt
  const validation = validateLeaveAt(liveLeaveAt, now)
  const durationMin = validation.ok ? validation.durationMin : 0
  const displayError =
    leaveAtError ||
    typeError ||
    ((isEditingTime ? Boolean(maskHm) : true) && !validation.ok
      ? validation.error
      : "")

  // Sync mask when chips / parent leaveAt change (not while typing).
  useEffect(() => {
    if (isEditingTime) return
    setMask(leaveAtToMaskParts(leaveAt))
  }, [leaveAt, isEditingTime])

  /** Push a complete mask to parent → clears quick stay + refreshes stay length. */
  const pushMaskIfComplete = (next: LeaveAtMaskParts) => {
    const parsed = parseLeaveAtMask(next)
    if (!parsed) return
    setTypeError("")
    onLeaveAtTimeChange(parsed)
  }

  const updateMask = (next: LeaveAtMaskParts) => {
    setMask(next)
    setTypeError("")
    pushMaskIfComplete(next)
  }

  const commitMask = (next: LeaveAtMaskParts) => {
    const parsed = parseLeaveAtMask(next)
    if (!parsed) {
      setTypeError("Enter a time like 4:30 PM")
      return false
    }
    setTypeError("")
    onLeaveAtTimeChange(parsed)
    setIsEditingTime(false)
    return true
  }

  const startEditingTime = () => {
    setIsEditingTime(true)
    setTypeError("")
    setMask(leaveAtToMaskParts(leaveAt))
    requestAnimationFrame(() => {
      hourInputRef.current?.focus()
      hourInputRef.current?.select()
    })
  }

  const cancelEditing = () => {
    setIsEditingTime(false)
    setTypeError("")
    setMask(leaveAtToMaskParts(leaveAt))
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/10 p-4 lg:p-8 dark:bg-background">
      <Card className="w-full max-w-4xl border-0 shadow-2xl ring-1 ring-border/50">
        <CardHeader className="border-b border-border/40 pb-6 pt-10 text-center">
          <CardTitle className="text-4xl font-black tracking-tight text-foreground">
            Marie Mount Hall
          </CardTitle>
          <p className="mt-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Traffic Logger
          </p>
        </CardHeader>

        <CardContent className="p-0">
          <div className="grid grid-cols-1 divide-y divide-border/40 md:grid-cols-2 md:divide-x md:divide-y-0">
            <div className="flex flex-col justify-between space-y-8 p-6 md:p-8">
              <div className="space-y-8">
                <div className="space-y-3">
                  <Label
                    htmlFor="uid"
                    className="text-sm font-semibold text-foreground/80"
                  >
                    Student UID
                  </Label>
                  <div className="relative group">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 transition-colors group-focus-within:text-primary">
                      <UserIcon className="h-5 w-5 text-muted-foreground/60 transition-colors group-focus-within:text-primary" />
                    </div>
                    <Input
                      id="uid"
                      ref={uidInputRef}
                      suppressHydrationWarning
                      type="text"
                      pattern="\d*"
                      inputMode="numeric"
                      maxLength={9}
                      value={uid}
                      onChange={(e) =>
                        onUidChange(e.target.value.replace(/\D/g, ""))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          onSubmit()
                        }
                      }}
                      placeholder="Enter 9-digit UID"
                      className={`h-14 rounded-xl pl-12 text-lg shadow-sm ${
                        uidError
                          ? "border-destructive bg-destructive/10 focus-visible:ring-destructive"
                          : "bg-card"
                      }`}
                    />
                  </div>
                  {uidError ? (
                    <p className="ml-1 text-xs font-semibold text-destructive">
                      {uidError}
                    </p>
                  ) : (
                    <p className="ml-1 text-xs font-medium text-muted-foreground">
                      9-digit University ID
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  <Label className="text-sm font-semibold text-foreground/80">
                    Quick stay
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { label: "30 min", val: 30 as const },
                        { label: "1 hr", val: 60 as const },
                        { label: "1.5 hr", val: 90 as const },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => {
                          setIsEditingTime(false)
                          setTypeError("")
                          onSelectQuickStay(opt.val)
                        }}
                        className={`flex h-14 items-center justify-center rounded-xl border-2 text-sm font-semibold transition-transform active:scale-95 ${
                          quickStay === opt.val
                            ? "border-primary bg-primary/5 text-primary shadow-sm ring-1 ring-primary/20"
                            : "border-border bg-card text-foreground hover:bg-muted/50"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <p className="text-xs font-medium text-muted-foreground">
                Choose a stay or type your exit time.
              </p>
            </div>

            <div className="flex flex-col justify-between gap-8 p-6 md:p-8">
              <div className="space-y-4">
                <Label
                  htmlFor="leave-at-hour"
                  className="text-sm font-semibold text-foreground/80"
                >
                  What time are you leaving?
                </Label>

                <div
                  className={`relative flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 px-4 py-6 text-center ${
                    displayError
                      ? "border-destructive bg-destructive/5"
                      : "border-border bg-card"
                  }`}
                >
                  {isEditingTime ? (
                    <>
                      <div className="flex items-center justify-center gap-1 tabular-nums">
                        <input
                          id="leave-at-hour"
                          ref={hourInputRef}
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          spellCheck={false}
                          aria-label="Leave hour"
                          placeholder="_"
                          value={mask.hour}
                          onChange={(e) => {
                            const hour = sanitizeLeaveAtMaskHour(e.target.value)
                            updateMask({ ...mask, hour })
                            // Auto-advance: 2 digits, or single digit 3–9
                            if (
                              hour.length === 2 ||
                              (hour.length === 1 && Number(hour) >= 3)
                            ) {
                              requestAnimationFrame(() => {
                                minuteInputRef.current?.focus()
                                minuteInputRef.current?.select()
                              })
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              if (commitMask(mask)) onSubmit()
                            }
                            if (e.key === "Escape") {
                              e.preventDefault()
                              cancelEditing()
                            }
                            if (
                              e.key === ":" ||
                              e.key === "ArrowRight" ||
                              e.key === " "
                            ) {
                              e.preventDefault()
                              minuteInputRef.current?.focus()
                              minuteInputRef.current?.select()
                            }
                          }}
                          className="w-[2.5ch] border-0 bg-transparent p-0 text-center text-5xl font-extrabold tracking-tighter text-foreground outline-none placeholder:text-muted-foreground/50 lg:text-6xl"
                        />
                        <span
                          className="select-none text-5xl font-extrabold tracking-tighter text-foreground lg:text-6xl"
                          aria-hidden
                        >
                          :
                        </span>
                        <input
                          id="leave-at-minute"
                          ref={minuteInputRef}
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          spellCheck={false}
                          aria-label="Leave minute"
                          placeholder="__"
                          value={mask.minute}
                          onChange={(e) => {
                            const minute = sanitizeLeaveAtMaskMinute(
                              e.target.value
                            )
                            updateMask({ ...mask, minute })
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              if (commitMask(mask)) onSubmit()
                            }
                            if (e.key === "Escape") {
                              e.preventDefault()
                              cancelEditing()
                            }
                            if (
                              (e.key === "Backspace" && mask.minute === "") ||
                              e.key === "ArrowLeft"
                            ) {
                              e.preventDefault()
                              hourInputRef.current?.focus()
                              hourInputRef.current?.select()
                            }
                          }}
                          className="w-[2.75ch] border-0 bg-transparent p-0 text-center text-5xl font-extrabold tracking-tighter text-foreground outline-none placeholder:text-muted-foreground/50 lg:text-6xl"
                        />
                        <div className="ml-3 flex flex-col gap-1">
                          {(["AM", "PM"] as const).map((period) => (
                            <button
                              key={period}
                              type="button"
                              onClick={() => {
                                updateMask({ ...mask, period })
                              }}
                              className={`rounded-md px-2.5 py-1 text-sm font-bold transition-colors ${
                                mask.period === period
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground hover:bg-muted/80"
                              }`}
                            >
                              {period}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="flex w-full items-center justify-center gap-3 py-4"
                      onClick={startEditingTime}
                      aria-label="Type leave time"
                    >
                      <span
                        className="text-5xl font-extrabold tracking-tighter text-foreground tabular-nums lg:text-6xl"
                        suppressHydrationWarning
                      >
                        {formatLeaveAtClock(leaveAt)}
                      </span>
                      <Pencil
                        className="size-5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    </button>
                  )}
                </div>

                {displayError ? (
                  <p className="text-center text-base font-semibold text-destructive">
                    {displayError}
                  </p>
                ) : (
                  <p
                    className="text-center text-base font-medium text-foreground"
                    suppressHydrationWarning
                  >
                    {formatDuration(durationMin)} stay
                  </p>
                )}
              </div>

              <div>
                <Button
                  onClick={() => {
                    if (isEditingTime) {
                      if (!commitMask(mask)) return
                    }
                    onSubmit()
                  }}
                  disabled={
                    isSubmitting ||
                    Boolean(typeError) ||
                    !validation.ok ||
                    (isEditingTime && !maskHm)
                  }
                  className="group h-16 w-full rounded-2xl bg-success text-xl font-bold text-success-foreground shadow-lg transition-transform hover:bg-success/90 active:scale-[0.98] disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
                  size="lg"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-3">Submitting...</span>
                  ) : (
                    <span className="flex items-center gap-3">
                      <CheckCircle2 className="h-7 w-7 transition-transform group-hover:scale-110" />
                      Record Traffic
                    </span>
                  )}
                </Button>
                <p className="mx-auto mt-4 max-w-sm text-center text-xs font-medium text-muted-foreground">
                  Press Enter to submit
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
