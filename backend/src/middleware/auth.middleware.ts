/**
 * @file auth.middleware.ts
 * @module backend/middleware
 *
 * JWT verification and role-based access control for every authenticated
 * route. This is the only place in the backend that reads the Authorization
 * header, verifies tokens with Supabase, and populates req.authUser /
 * req.profile. It also calls runWithToken() so downstream services can
 * obtain a user-scoped Supabase client via getSupabaseClient().
 *
 * ## Responsibilities
 * - Define the AuthenticatedRequest request shape
 * - requireAuth, requireTeamLeaderOrAbove, requireDeveloper: the role gates
 *   http/endpoint.ts attaches for each contract's `access` (self-or-team-leader
 *   is checked in endpoint.ts after validation)
 *
 * ## What does NOT belong here
 * - Endpoint handlers (controllers/*.controller.ts)
 * - Application-wide middleware unrelated to auth (logging etc. — see request-logger.ts)
 */
import type { NextFunction, Request, Response } from "express";
import {
  canAccessRequestedScholarId,
  hasRoleAtLeast,
  isDeveloperProfile,
  mergeProfileWithRoster,
  parseRequestedScholarId,
} from "@css-atlas/shared/auth";
import type { ProfilesRow } from "../models/user.model.js";
import { getSupabaseAuthClient, getSupabaseClient, runWithToken } from "../supabase/client.js";
import { resolveEffectiveProfile } from "../services/dev-profile.service.js";
import { rejectWritesWhenActing } from "./reject-writes-when-acting.js";

export interface AuthenticatedRequest extends Request {
  authUser?: { id: string; email?: string };
  /** Effective profile (real or test overlay). */
  profile?: ProfilesRow | null;
  /** Developer's own merged profile — never overlaid. */
  realProfile?: ProfilesRow | null;
  activeTestProfileId?: string | null;
  isActingAsTestProfile?: boolean;
  /** Raw bearer token — available after auth middleware runs. */
  accessToken?: string;
}

async function authenticate(req: AuthenticatedRequest): Promise<boolean> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return false;
  const token = header.slice(7);

  let authSupabase;
  try {
    authSupabase = getSupabaseAuthClient();
  } catch {
    return false;
  }

  // Verify token with publishable key client
  const { data: { user }, error } = await authSupabase.auth.getUser(token);
  if (error || !user) return false;

  // Store token so downstream services can create user-scoped clients
  req.accessToken = token;

  // Fetch profile using the user's own token (RLS applies). Prefer the roster
  // embed for mergeProfileWithRoster, but fall back to profiles-only when the
  // embed errors — otherwise a join failure looks like "no profile" and the
  // dashboard loops users into /auth/complete-profile while INSERT hits
  // profiles_pkey.
  const supabase = getSupabaseClient();
  // Pin the FK: junction-shaped tables (e.g. mentee_meeting_preferences) make
  // a bare user_roster(*) embed ambiguous (PGRST201).
  let profile: ProfilesRow | null = null;
  const withRoster = await supabase
    .from("profiles")
    .select("*, user_roster!profiles_student_id_fkey(*)")
    .eq("id", user.id)
    .maybeSingle();
  if (withRoster.error) {
    console.error("[auth] profiles+user_roster select failed; retrying profiles-only", {
      userId: user.id,
      message: withRoster.error.message,
      code: withRoster.error.code,
    });
    const plain = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    // Never treat a failed read as "no profile" — that triggers onboarding inserts.
    if (plain.error) throw plain.error;
    profile = (plain.data as ProfilesRow | null) ?? null;
  } else {
    profile = (withRoster.data as ProfilesRow | null) ?? null;
  }

  const merged = profile ? mergeProfileWithRoster(profile) : null;

  req.authUser = { id: user.id, email: user.email };
  req.realProfile = merged;

  const effective = await resolveEffectiveProfile(req.headers, merged);
  req.profile = effective.profile;
  req.activeTestProfileId = effective.activeTestProfileId;
  req.isActingAsTestProfile = effective.isActingAsTestProfile;

  return true;
}

function buildAuthMiddleware(role?: { check: (req: AuthenticatedRequest) => boolean; message: string }) {
  return async function (req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const token = req.headers.authorization?.slice(7) ?? "";
    await runWithToken(token, async () => {
      try {
        if (!(await authenticate(req))) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
      } catch (err) {
        next(err);
        return;
      }
      if (role && !role.check(req)) {
        res.status(403).json({ error: role.message });
        return;
      }
      rejectWritesWhenActing(req, res, next);
    });
  };
}

export const requireAuth = buildAuthMiddleware();

export const requireTeamLeaderOrAbove = buildAuthMiddleware({
  check: (req) => hasRoleAtLeast(req.profile?.app_role ?? null, "team_leader"),
  message: "Forbidden: Team leader or above required",
});

export const requireDeveloper = buildAuthMiddleware({
  check: (req) => isDeveloperProfile(req.realProfile),
  message: "Forbidden: Developer access required",
});
