"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { recordTrafficEntry } from "@/lib/server/actions"
import { useMinuteNow } from "@/hooks/use-minute-now"
import {
  TrafficCheckInForm,
  type QuickStayMinutes,
} from "./_components/traffic-check-in-form"
import { TrafficSuccessScreen } from "./_components/traffic-success-screen"
import {
  leaveAtFromNowPlusMinutes,
  parseLeaveAtTimeInput,
  validateLeaveAt,
} from "./_components/traffic-format"

const DEFAULT_STAY_MINUTES: QuickStayMinutes = 60

export default function TrafficPage() {
  const now = useMinuteNow()
  const [uid, setUid] = useState("")
  const [uidError, setUidError] = useState("")
  const [leaveAtError, setLeaveAtError] = useState("")
  const [quickStay, setQuickStay] = useState<QuickStayMinutes | null>(
    DEFAULT_STAY_MINUTES
  )
  const [leaveAt, setLeaveAt] = useState(() =>
    leaveAtFromNowPlusMinutes(DEFAULT_STAY_MINUTES)
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  /** Submitted stay length for the success overlay only. */
  const [successExitMinutes, setSuccessExitMinutes] = useState<number | null>(
    null
  )

  const uidInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    uidInputRef.current?.focus()
  }, [])

  // Keep chip-based leave-at aligned with a ticking clock so duration stays accurate.
  useEffect(() => {
    if (quickStay == null) return
    setLeaveAt(leaveAtFromNowPlusMinutes(quickStay, now))
  }, [now, quickStay])

  const validateUid = (): boolean => {
    if (!uid || uid.length !== 9 || !/^\d{9}$/.test(uid)) {
      setUidError("UID must be exactly 9 digits")
      uidInputRef.current?.focus()
      return false
    }
    setUidError("")
    return true
  }

  const handleSelectQuickStay = (minutes: QuickStayMinutes) => {
    setQuickStay(minutes)
    setLeaveAtError("")
    setLeaveAt(leaveAtFromNowPlusMinutes(minutes))
  }

  const handleLeaveAtTimeChange = (timeHm: string) => {
    if (!/^\d{2}:\d{2}$/.test(timeHm)) return
    setQuickStay(null)
    setLeaveAtError("")
    setLeaveAt(parseLeaveAtTimeInput(timeHm))
  }

  const handleSubmitTraffic = async () => {
    if (isSubmitting) return

    if (!validateUid()) {
      return
    }

    const submitNow = new Date()
    const effectiveLeaveAt =
      quickStay != null
        ? leaveAtFromNowPlusMinutes(quickStay, submitNow)
        : leaveAt
    const validation = validateLeaveAt(effectiveLeaveAt, submitNow)
    if (!validation.ok) {
      setLeaveAtError(validation.error)
      toast.error(validation.error)
      return
    }

    setIsSubmitting(true)
    try {
      const result = await recordTrafficEntry({
        uid,
        duration_min: validation.durationMin,
      })

      if ("error" in result && result.error) {
        toast.error(result.error)
        return
      }

      setSuccessExitMinutes(validation.durationMin)
      setShowSuccess(true)

      setUid("")
      setUidError("")
      setLeaveAtError("")
      setQuickStay(DEFAULT_STAY_MINUTES)
      setLeaveAt(leaveAtFromNowPlusMinutes(DEFAULT_STAY_MINUTES))

      setTimeout(() => {
        setShowSuccess(false)
        setSuccessExitMinutes(null)
        setTimeout(() => uidInputRef.current?.focus(), 100)
      }, 1500)
    } catch (err) {
      console.error("Unexpected error:", err)
      toast.error("An unexpected error occurred.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const submitRef = useRef(handleSubmitTraffic)
  useEffect(() => {
    submitRef.current = handleSubmitTraffic
  })

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        const target = e.target as HTMLElement
        if (target.tagName === "INPUT") return
        if (
          target.tagName === "BUTTON" &&
          target.textContent?.includes("Record Traffic")
        )
          return

        e.preventDefault()
        submitRef.current()
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown)
    return () => window.removeEventListener("keydown", handleGlobalKeyDown)
  }, [])

  if (showSuccess) {
    return (
      <TrafficSuccessScreen exitMinutes={successExitMinutes ?? 0} />
    )
  }

  return (
    <TrafficCheckInForm
      uid={uid}
      uidError={uidError}
      uidInputRef={uidInputRef}
      quickStay={quickStay}
      leaveAt={leaveAt}
      leaveAtError={leaveAtError}
      isSubmitting={isSubmitting}
      onUidChange={(value) => {
        setUid(value)
        setUidError("")
      }}
      onSelectQuickStay={handleSelectQuickStay}
      onLeaveAtTimeChange={handleLeaveAtTimeChange}
      onSubmit={handleSubmitTraffic}
    />
  )
}
