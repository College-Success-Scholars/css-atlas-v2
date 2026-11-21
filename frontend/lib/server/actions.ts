/**
 * @file actions.ts
 * @module frontend/lib/server
 *
 * Next.js Server Actions for form submissions and data mutations from the frontend.
 * Server Actions marked with "use server" can be called directly from Client Components
 * and are executed securely on the server.
 *
 * ## Responsibilities
 * - Handle profile update mutations (basic info, etc.)
 * - Self-service mentee assignment add/remove (`addMentee`, `removeMentee`)
 * - Public `/traffic` kiosk check-in (`recordTrafficEntry`) — no auth, schema-validated write
 * - Teams board excuse upsert (`upsertAttendanceExcuseAction`) via backend `BACKEND_URL`
 * - Teams tutoring single-row delete (`deleteTutorReportAction`) via backend `BACKEND_URL`
 * - Validate inputs with Effect Schema (via @css-atlas/shared/contract) before writing to Supabase or calling the backend
 * - Revalidate Next.js cache paths after mutations
 *
 * ## What belongs here
 * - "use server" functions that handle form submissions or mutations
 * - Input validation schemas
 *
 * ## What does NOT belong here
 * - Data fetching (use data.ts or api-client.ts instead)
 * - Client-side logic
 * - Traffic analytics reads (auth-gated `/api/traffic` / `/dev/traffic`)
 */
"use server"

import { createClient } from "@/lib/supabase/server"
import { backendPost } from "@/lib/server/api-client"
import { deleteTutorReport, upsertAttendanceExcuse } from "@/lib/server/data"
import { DEV_ACTIVE_PROFILE_COOKIE, hasRoleAtLeast } from "@css-atlas/shared/auth"
import { Schema, scholarId, validate } from "@css-atlas/shared/contract"
import { upsertExcuse } from "@css-atlas/shared/contracts/attendance"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"

const name = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(100))

const basicInfoSchema = Schema.Struct({
  first_name: name,
  last_name: name,
  phone: Schema.optional(Schema.String.check(Schema.isMaxLength(20))),
})

export async function updateBasicInfo(formData: unknown) {
  const parsed = validate(basicInfoSchema, formData)
  if (!parsed.ok) {
    return { error: "Invalid input" }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", user.id)

  if (error) return { error: error.message }

  revalidatePath("/settings")
  return { success: true }
}

const menteeUidSchema = scholarId

type MenteeMutationResult = { error: string } | { success: true }

type MenteeMutationContext =
  | { error: string }
  | {
      supabase: Awaited<ReturnType<typeof createClient>>
      user: { id: string }
    }

/**
 * Shared auth/role gate for mentee mutations. Writes are blocked while a
 * developer is acting as a test profile so the persona view never edits the
 * developer's own assignments.
 */
async function getMenteeMutationContext(): Promise<MenteeMutationContext> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" as const }

  const cookieStore = await cookies()
  if (cookieStore.get(DEV_ACTIVE_PROFILE_COOKIE)?.value) {
    return { error: "Switch to My profile to make changes." as const }
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("app_role")
    .eq("id", user.id)
    .maybeSingle()
  if (error) return { error: error.message }

  if (!hasRoleAtLeast(profile?.app_role ?? null, "team_leader")) {
    return { error: "Team leader access required" as const }
  }

  return { supabase, user } as const
}

/** Add an enrolled scholar to the caller's mentee list. */
export async function addMentee(input: unknown): Promise<MenteeMutationResult> {
  const parsed = validate(menteeUidSchema, input)
  if (!parsed.ok) return { error: "Invalid mentee" }

  const ctx = await getMenteeMutationContext()
  if ("error" in ctx) return { error: ctx.error }

  const { data: scholar, error: scholarError } = await ctx.supabase
    .from("user_roster")
    .select("uid, status, program_role")
    .eq("uid", parsed.data)
    .maybeSingle()
  if (scholarError) return { error: scholarError.message }

  if (
    !scholar ||
    (scholar.status ?? "").toLowerCase() !== "enrolled" ||
    (scholar.program_role ?? "").toLowerCase() !== "scholar"
  ) {
    return { error: "Select an enrolled scholar." }
  }

  const { error } = await ctx.supabase.from("mentor_mentee").insert({
    mentor_id: ctx.user.id,
    mentee_uid: parsed.data,
  })
  if (error) {
    if (error.code === "23505") {
      return { error: "That scholar is already your mentee." }
    }
    return { error: error.message }
  }

  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard")
  return { success: true as const }
}

/** Remove one of the caller's mentee assignments. */
export async function removeMentee(input: unknown): Promise<MenteeMutationResult> {
  const parsed = validate(menteeUidSchema, input)
  if (!parsed.ok) return { error: "Invalid mentee" }

  const ctx = await getMenteeMutationContext()
  if ("error" in ctx) return { error: ctx.error }

  const { error } = await ctx.supabase
    .from("mentor_mentee")
    .delete()
    .eq("mentor_id", ctx.user.id)
    .eq("mentee_uid", parsed.data)
  if (error) return { error: error.message }

  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/memo")
  revalidatePath("/dashboard/mentee")
  return { success: true as const }
}

const scholarProfileSchema = Schema.Struct({
  first_name: name,
  last_name: name,
  student_id: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(50)),
  phone_number: Schema.optional(Schema.NullOr(Schema.String.check(Schema.isMaxLength(20)))),
  cohort: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
})

export async function createScholarProfile(formData: unknown) {
  const parsed = validate(scholarProfileSchema, formData)
  if (!parsed.ok) {
    return { error: "Invalid input" }
  }

  try {
    await backendPost("/api/auth/profile", {
      ...parsed.data,
      phone_number: parsed.data.phone_number ?? null,
    })
    revalidatePath("/dashboard")
    revalidatePath("/auth/complete-profile")
    return { success: true as const }
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to create profile",
    }
  }
}

/** Public kiosk check-in: 9-digit UID + stay length only. */
const trafficEntrySchema = Schema.Struct({
  uid: Schema.String.check(Schema.isPattern(/^\d{9}$/)),
  duration_min: Schema.Number.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 720 })),
})

/**
 * Record a foot-traffic entry from the public `/traffic` kiosk.
 * No auth required. Rejects extra fields; forces `traffic_type: "entry"`;
 * leaves `created_at` to the database default (no client-controlled timestamps).
 */
export async function recordTrafficEntry(input: unknown) {
  const parsed = validate(trafficEntrySchema, input)
  if (!parsed.ok) {
    return { error: "Invalid traffic entry" }
  }

  const supabase = await createClient()
  const { error } = await supabase.from("traffic").insert({
    uid: parsed.data.uid,
    duration_min: parsed.data.duration_min,
    traffic_type: "entry",
  })

  if (error) {
    return { error: "Failed to submit traffic entry" }
  }

  return { success: true as const }
}

/**
 * Upsert a campus-week FD/SS excuse from the teams board.
 * Uses the server backend client (`BACKEND_URL`) so Railway does not need
 * `NEXT_PUBLIC_BACKEND_URL` inlined at image build time.
 */
export async function upsertAttendanceExcuseAction(input: unknown) {
  const parsed = validate(upsertExcuse.body, input)
  if (!parsed.ok) {
    return { error: `${parsed.field} ${parsed.message}`.trim() }
  }

  try {
    await upsertAttendanceExcuse(parsed.data)
    revalidatePath("/dashboard/teams/front-desk")
    revalidatePath("/dashboard/teams/study")
    return { success: true as const }
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to save excuse",
    }
  }
}

const tutorReportIdSchema = Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0))

/** Delete one tutor report from the teams tutoring page (TL+; RLS enforced by the backend JWT client). */
export async function deleteTutorReportAction(id: unknown) {
  const parsed = validate(tutorReportIdSchema, id)
  if (!parsed.ok) {
    return { error: "Invalid input" }
  }

  try {
    await deleteTutorReport(parsed.data)
    revalidatePath("/dashboard/teams/tutoring")
    revalidatePath("/dashboard/memo")
    revalidatePath("/dashboard/mentee")
    return { success: true as const }
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to remove tutoring session",
    }
  }
}
