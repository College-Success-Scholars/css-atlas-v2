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
 * - Define the AuthenticatedRequest / AuthedRequest request shapes
 * - requireAuth, requireTeamLeaderOrAbove, requireTeamLeaderRole,
 *   requireDeveloper, requireSelfOrTeamLeader, requireSelfScholarIdOrTeamLeader
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
} from "../../../shared/dist/auth.js";
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

/** Request after `requireAuth` (or equivalent) has populated `authUser`. */
export interface AuthedRequest extends AuthenticatedRequest {
  authUser: { id: string; email?: string };
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

  // Fetch profile using the user's own token (RLS applies)
  const supabase = getSupabaseClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*, user_roster(*)")
    .eq("id", user.id)
    .maybeSingle();

  const merged = profile ? mergeProfileWithRoster(profile as ProfilesRow) : null;

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
      if (!(await authenticate(req))) {
        res.status(401).json({ error: "Unauthorized" });
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

// requireTeamLeaderRole stays — it's a genuinely different job: a role-only
// gate for routers where requireAuth already ran. No re-verification needed.
export function requireTeamLeaderRole(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!hasRoleAtLeast(req.profile?.app_role ?? null, "team_leader")) {
    res.status(403).json({ error: "Forbidden: Team leader or above required" });
    return;
  }
  next();
}

/**
 * Requires that the authenticated user is either:
 * 1. Accessing their own data (req.params.uid matches their student_id), or
 * 2. A team leader or above (can access any uid).
 *
 * Must be used AFTER requireAuth (needs req.profile to be populated).
 * The :uid route param is compared against profile.student_id.
 */
export function requireSelfOrTeamLeader(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const requestedUid = Array.isArray(req.params.uid) ? req.params.uid[0] : req.params.uid;
  if (!requestedUid) {
    res.status(400).json({ error: "Missing uid parameter" });
    return;
  }

  if (canAccessRequestedScholarId(req.profile, requestedUid)) {
    next();
    return;
  }

  res.status(403).json({ error: "Forbidden: Can only access your own data" });
}

/**
 * Same gate as requireSelfOrTeamLeader, but the roster uid comes from the JSON
 * body (`scholarId` or legacy `studentId`). Missing id is allowed (handler
 * returns empty). Must run AFTER requireAuth.
 */
export function requireSelfScholarIdOrTeamLeader(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const scholarId = parseRequestedScholarId(req.body);
  if (!scholarId) {
    next();
    return;
  }

  if (canAccessRequestedScholarId(req.profile, scholarId)) {
    next();
    return;
  }

  res.status(403).json({ error: "Forbidden: Can only access your own data" });
}
