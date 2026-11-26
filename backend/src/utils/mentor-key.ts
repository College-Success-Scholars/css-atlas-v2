/**
 * @file mentor-key.ts
 * @module backend/utils
 *
 * Resolves the key used to look up "my mentees" — the real auth user id,
 * unless a developer is acting as a test profile, in which case the test
 * profile's student_id stands in so the acting view sees that scholar's
 * mentees rather than the developer's own.
 */
import type { Caller } from "../context/current-caller.js";

export function resolveMentorKey(caller: Caller): string {
  return caller.isActingAsTestProfile && caller.profile?.student_id != null
    ? String(caller.profile.student_id)
    : caller.userId;
}
