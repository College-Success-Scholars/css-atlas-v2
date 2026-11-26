/**
 * @file auth.controller.ts
 * @module backend/controllers
 *
 * Handlers for the identity half of /api/auth, bound to
 * @css-atlas/shared/contracts/auth: the caller's own user and profile, and
 * self-service onboarding. JWT verification and role gates live in
 * middleware/auth.middleware.ts and run before these handlers.
 *
 * ## What does NOT belong here
 * - Mentee-roster or semester lookups (controllers/mentees.controller.ts,
 *   controllers/semester.controller.ts)
 */
import { isDeveloperProfile, isUmdEmail } from "@css-atlas/shared/auth";
import * as contract from "@css-atlas/shared/contracts/auth";
import { implement } from "../http/endpoint.js";
import { createOwnProfile, getProfileById } from "../services/profile.service.js";
import { ConflictError, ForbiddenError, NotFoundError } from "../utils/domain-error.js";

export const authEndpoints = [
  implement(contract.getMe, async (_input, caller) => ({
    user: { id: caller.userId, email: caller.email },
    profile: caller.profile,
    ...(isDeveloperProfile(caller.realProfile)
      ? {
          realProfile: caller.realProfile,
          activeTestProfileId: caller.activeTestProfileId,
          isActingAsTestProfile: caller.isActingAsTestProfile,
        }
      : {}),
  })),

  implement(contract.getProfile, async (_input, caller) => {
    const profile = await getProfileById(caller.userId);
    if (!profile) throw new NotFoundError({ resource: "Profile" });
    return profile;
  }),

  implement(contract.createProfile, async ({ body }, caller) => {
    if (caller.realProfile) throw new ConflictError({ message: "Profile already exists" });
    if (!caller.email || !isUmdEmail(caller.email)) {
      throw new ForbiddenError({ reason: "A UMD email address is required to create a profile" });
    }
    return createOwnProfile({
      userId: caller.userId,
      email: caller.email,
      first_name: body.first_name,
      last_name: body.last_name,
      student_id: String(body.student_id),
      phone_number: body.phone_number?.trim() || null,
      cohort: body.cohort,
    });
  }),
];
