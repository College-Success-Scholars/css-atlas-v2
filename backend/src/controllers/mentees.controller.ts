/**
 * @file mentees.controller.ts
 * @module backend/controllers
 *
 * Handlers for /api/auth/mentees, bound to
 * @css-atlas/shared/contracts/mentees. requireAuth (and the effective-profile
 * and acting-as population of the caller) already ran upstream.
 *
 * ## What does NOT belong here
 * - JWT verification or profile resolution (middleware/auth.middleware.ts)
 */
import * as contract from "@css-atlas/shared/contracts/mentees";
import type { Caller } from "../context/current-caller.js";
import { implement } from "../http/endpoint.js";
import { getMenteeMcfPrefill } from "../services/mentee-mcf-prefill.service.js";
import { saveMeetingPreference } from "../services/mentee-meeting-preference.service.js";
import {
  getMenteeReviewByMentorKey,
  getMenteeReviewByUid,
} from "../services/mentee-review-activity.service.js";
import { toWireMenteeReview } from "../services/mentee-review-wire.js";
import { getMenteesByMentorKey } from "../services/mentee.service.js";
import { dateToCampusWeek } from "../services/time.service.js";
import { ConflictError, ForbiddenError, NotFoundError, UnavailableError, ValidationError } from "../utils/domain-error.js";
import { resolveMentorKey } from "../utils/mentor-key.js";

/** Current week is the default; a future week is rejected. */
function selectedWeek(week: number | undefined, caller: Caller): number | null {
  if (week === undefined) return null;
  const currentWeek = dateToCampusWeek(caller.asOf);
  if (currentWeek != null && week > currentWeek) {
    throw new ValidationError({ field: "", message: "Cannot select a future week" });
  }
  return week;
}

function mcfPrefillFailure(error: { code: string; message: string }) {
  switch (error.code) {
    case "mentee_not_found":
      return new NotFoundError({ resource: "Mentee" });
    case "mentor_uid_unavailable":
      return new ConflictError({ message: error.message });
    default:
      return new UnavailableError({ message: error.message });
  }
}

export const menteeEndpoints = [
  implement(contract.getMentees, (_input, caller) => getMenteesByMentorKey(resolveMentorKey(caller))),

  // A mentee outside the caller's RLS-scoped roster yields a non-enumerating 404.
  implement(contract.getMenteeReview, async ({ params, query }, caller) => {
    const review = await getMenteeReviewByMentorKey({
      mentorKey: resolveMentorKey(caller),
      menteeUid: params.uid,
      selectedWeek: selectedWeek(query.week, caller),
    });
    if (!review) throw new NotFoundError({ resource: "Mentee" });
    return toWireMenteeReview(review);
  }),

  // Team-leader+ read of any scholar with a mentor_mentee assignment, for the
  // directory detail page, which is not scoped to the caller's own mentees.
  implement(contract.getDirectoryMenteeReview, async ({ params, query }, caller) => {
    const review = await getMenteeReviewByUid({
      menteeUid: params.uid,
      selectedWeek: selectedWeek(query.week, caller),
    });
    if (!review) throw new NotFoundError({ resource: "Mentee" });
    return toWireMenteeReview(review);
  }),

  // The owner is the authenticated user (never a request-body id). Both fields
  // are written atomically; a failed save preserves the previous value.
  implement(contract.saveMeetingPreference, async ({ params, body }, caller) => {
    const result = await saveMeetingPreference({
      mentorId: caller.userId,
      menteeUid: params.uid,
      weekday: body.weekday,
      meetingTime: body.meetingTime,
    });
    if (result.ok) return result.data;
    if (result.error.code === "not_assigned") throw new ForbiddenError({ reason: result.error.message });
    // save_failed: the write did not happen and the old preference stands; say so, and invite a retry.
    throw new UnavailableError({ message: result.error.message });
  }),

  // Fresh click-time prefill for the CURRENT week: recomposes evidence at
  // activation and never submits. Unknown sources block it with an actionable error.
  implement(contract.getMenteeMcfPrefill, async ({ params }, caller) => {
    const profile = caller.profile;
    const result = await getMenteeMcfPrefill({
      mentorId: caller.userId,
      mentorFullName:
        profile?.full_name?.trim() ||
        [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim(),
      mentorUid: profile?.student_id ?? null,
      menteeUid: params.uid,
    });
    if (!result.ok) throw mcfPrefillFailure(result.error);
    return result.data;
  }),
];
