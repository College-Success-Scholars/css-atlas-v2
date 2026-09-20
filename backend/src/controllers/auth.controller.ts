/**
 * @file auth.controller.ts
 * @module backend/controllers
 *
 * Identity endpoint handlers: the caller's own profile and self-service
 * onboarding. JWT verification and role gates live in
 * middleware/auth.middleware.ts — this file only handles requests after
 * that middleware has already run.
 *
 * ## Responsibilities
 * - Provide auth endpoint handlers: getMe, getProfile, createProfile
 * - `authed()`, the composition point that hands a handler an `AuthedRequest`
 *
 * ## What does NOT belong here
 * - JWT extraction, Supabase token verification, or role-based access
 *   control (middleware/auth.middleware.ts)
 * - Mentee-roster or semester lookups (controllers/mentees.controller.ts,
 *   controllers/semester.controller.ts)
 */
import type { RequestHandler, Response } from "express";
import { getSupabaseClient } from "../supabase/client.js";
import { isDeveloperProfile, isUmdEmail } from "../../../shared/dist/auth.js";
import { createScholarProfile } from "../services/user.service.js";
import { asyncHandler } from "../utils/async-handler.js";
import { parseCreateProfileBody } from "../utils/request-validation.js";
import type { AuthedRequest } from "../middleware/auth.middleware.js";

/**
 * Marks a handler as requiring `requireAuth` (or equivalent) upstream.
 * Express will not narrow `Request` across middleware, so this is the
 * composition point that hands the handler an `AuthedRequest`.
 */
export function authed(
  handler: (req: AuthedRequest, res: Response) => void | Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req as AuthedRequest, res)).catch(next);
  };
}

// GET /api/auth/me
export async function getMe(req: AuthedRequest, res: Response) {
  const isDev = isDeveloperProfile(req.realProfile);
  res.json({
    user: { id: req.authUser.id, email: req.authUser.email ?? null },
    profile: req.profile ?? null,
    ...(isDev
      ? {
          realProfile: req.realProfile ?? null,
          activeTestProfileId: req.activeTestProfileId ?? null,
          isActingAsTestProfile: req.isActingAsTestProfile ?? false,
        }
      : {}),
  });
}

// GET /api/auth/profile
export const getProfile = asyncHandler(async (req, res) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", req.authUser!.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) { res.status(404).json({ error: "Profile not found" }); return; }
  res.json({ data });
});

// POST /api/auth/profile — self-service scholar onboarding
export const createProfile = asyncHandler(async (req, res) => {
  if (req.realProfile) {
    res.status(409).json({ error: "Profile already exists" });
    return;
  }

  const email = req.authUser!.email;
  if (!email || !isUmdEmail(email)) {
    res.status(403).json({ error: "A UMD email address is required to create a profile" });
    return;
  }

  const parsed = parseCreateProfileBody(req.body);
  if (!parsed) {
    res.status(400).json({
      error: "Invalid body: first_name, last_name, student_id (numeric), and cohort are required",
    });
    return;
  }

  const data = await createScholarProfile({
    userId: req.authUser!.id,
    email,
    ...parsed,
  });
  res.status(201).json({ data });
});
