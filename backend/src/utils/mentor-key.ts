/**
 * @file mentor-key.ts
 * @module backend/utils
 *
 * Resolves the key used to look up "my mentees" — the real auth user id,
 * unless a developer is acting as a test profile, in which case the test
 * profile's student_id stands in so the acting view sees that scholar's
 * mentees rather than the developer's own.
 */
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";

export function resolveMentorKey(req: AuthenticatedRequest): string {
  return req.isActingAsTestProfile && req.profile?.student_id != null
    ? String(req.profile.student_id)
    : req.authUser!.id;
}
