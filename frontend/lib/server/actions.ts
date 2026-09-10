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
 * - Public `/traffic` kiosk check-in (`recordTrafficEntry`) — no auth, Zod-validated write
 * - Teams board excuse upsert (`upsertAttendanceExcuseAction`) via backend `BACKEND_URL`
 * - Validate inputs with Zod before writing to Supabase or calling the backend
 * - Revalidate Next.js cache paths after mutations
 *
 * ## What belongs here
 * - "use server" functions that handle form submissions or mutations
 * - Zod input validation schemas
 *
 * ## What does NOT belong here
 * - Data fetching (use data.ts or api-client.ts instead)
 * - Client-side logic
 * - Traffic analytics reads (auth-gated `/api/traffic` / `/dev/traffic`)
 */
"use server"

import { createClient } from "@/lib/supabase/server"
import { backendPost } from "@/lib/server/api-client"
import { upsertAttendanceExcuse } from "@/lib/server/data"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const basicInfoSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  phone: z.string().max(20).optional(),
})

export async function updateBasicInfo(formData: unknown) {
  const parsed = basicInfoSchema.safeParse(formData)
  if (!parsed.success) {
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

const scholarProfileSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  student_id: z.string().min(1).max(50),
  phone_number: z.string().max(20).nullable().optional(),
  cohort: z.number().int().positive(),
})

export async function createScholarProfile(formData: unknown) {
  const parsed = scholarProfileSchema.safeParse(formData)
  if (!parsed.success) {
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
const trafficEntrySchema = z.object({
  uid: z.string().regex(/^\d{9}$/),
  duration_min: z.number().int().min(1).max(720),
})

/**
 * Record a foot-traffic entry from the public `/traffic` kiosk.
 * No auth required. Rejects extra fields; forces `traffic_type: "entry"`;
 * leaves `created_at` to the database default (no client-controlled timestamps).
 */
export async function recordTrafficEntry(input: unknown) {
  const parsed = trafficEntrySchema.safeParse(input)
  if (!parsed.success) {
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

const attendanceExcuseSchema = z.object({
  uid: z.string().min(1).max(50),
  weekNum: z.number().int().positive(),
  kind: z.enum(["front_desk", "study_session"]),
  excuse_min: z.number().int().min(0).nullable(),
  description: z.string().max(2000).nullable(),
})

/**
 * Upsert a campus-week FD/SS excuse from the teams board.
 * Uses the server backend client (`BACKEND_URL`) so Railway does not need
 * `NEXT_PUBLIC_BACKEND_URL` inlined at image build time.
 */
export async function upsertAttendanceExcuseAction(input: unknown) {
  const parsed = attendanceExcuseSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Invalid input" }
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
