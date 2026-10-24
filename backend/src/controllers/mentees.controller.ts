/**
 * @file mentees.controller.ts
 * @module backend/controllers
 *
 * Mentee-roster endpoint handlers for the authenticated mentor. Mounted
 * under /api/auth/mentees* by routes/auth.routes.ts — requireAuth (and
 * req.profile / req.isActingAsTestProfile population) already ran upstream.
 *
 * ## Responsibilities
 * - getMentees, getMenteesWithCompliance
 * - getMenteeReview, getDirectoryMenteeReview, updateMenteeMeetingPreference
 * - getMenteeMcfPrefill
 *
 * ## What does NOT belong here
 * - JWT verification or profile resolution (middleware/auth.middleware.ts)
 */
import { getMenteesByMentorKey, getMenteesWithComplianceByMentorKey } from "../services/mentee.service.js";
import {
  getMenteeReviewByMentorKey,
  getMenteeReviewByUid,
} from "../services/mentee-review-activity.service.js";
import { saveMeetingPreference } from "../services/mentee-meeting-preference.service.js";
import { getMenteeMcfPrefill as getMenteeMcfPrefillForMentor } from "../services/mentee-mcf-prefill.service.js";
import { dateToCampusWeek } from "../services/time.service.js";
import { asyncHandler } from "../utils/async-handler.js";
import { resolveMentorKey } from "../utils/mentor-key.js";
import { MAX_DATE_RANGE_DAYS, parseDateRangeQuery } from "../utils/request-validation.js";

function firstParam(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.trim() ? raw.trim() : null;
}

/** Current week is the default; a future week is rejected. */
function parseSelectedWeek(
  rawWeek: unknown,
): { ok: true; week: number | null } | { ok: false; error: string } {
  const raw = Array.isArray(rawWeek) ? rawWeek[0] : rawWeek;
  if (raw === undefined || raw === "") return { ok: true, week: null };
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return { ok: false, error: "week must be a positive integer" };
  }
  const currentWeek = dateToCampusWeek(new Date());
  if (currentWeek != null && parsed > currentWeek) {
    return { ok: false, error: "Cannot select a future week" };
  }
  return { ok: true, week: parsed };
}

// GET /api/auth/mentees
export const getMentees = asyncHandler(async (req, res) => {
  const data = await getMenteesByMentorKey(resolveMentorKey(req));
  res.json({ data });
});

// GET /api/auth/mentees/compliance?startDate=<ISO>&endDate=<ISO>
export const getMenteesWithCompliance = asyncHandler(async (req, res) => {
  const range = parseDateRangeQuery(req.query);
  if (!range) {
    res.status(400).json({
      error: `startDate and endDate must be valid ISO date strings, with startDate <= endDate and a range of at most ${MAX_DATE_RANGE_DAYS} days`,
    });
    return;
  }

  const data = await getMenteesWithComplianceByMentorKey(resolveMentorKey(req), range);
  res.json({ data });
});

// GET /api/auth/mentees/:uid/review?week=<n>
// Authorized review DTO (own meeting preference included). Current week is the
// default; a future week is rejected. A mentee outside the caller's RLS-scoped
// roster yields a non-enumerating 404.
export const getMenteeReview = asyncHandler(async (req, res) => {
  const uid = firstParam(req.params.uid);
  if (!uid) {
    res.status(400).json({ error: "Missing mentee uid" });
    return;
  }

  const week = parseSelectedWeek(req.query.week);
  if (!week.ok) {
    res.status(400).json({ error: week.error });
    return;
  }

  const data = await getMenteeReviewByMentorKey({
    mentorKey: resolveMentorKey(req),
    menteeUid: uid,
    selectedWeek: week.week,
  });
  if (!data) {
    res.status(404).json({ error: "Mentee not found" });
    return;
  }
  res.json({ data });
});

// GET /api/auth/mentees/:uid/directory-review?week=<n>
// Team-leader+ read of any scholar with a mentor_mentee assignment. Used by the
// directory detail page, which is not scoped to the caller's own mentees.
export const getDirectoryMenteeReview = asyncHandler(async (req, res) => {
  const uid = firstParam(req.params.uid);
  if (!uid) {
    res.status(400).json({ error: "Missing mentee uid" });
    return;
  }

  const week = parseSelectedWeek(req.query.week);
  if (!week.ok) {
    res.status(400).json({ error: week.error });
    return;
  }

  const data = await getMenteeReviewByUid({
    menteeUid: uid,
    selectedWeek: week.week,
  });
  if (!data) {
    res.status(404).json({ error: "Mentee not found" });
    return;
  }
  res.json({ data });
});

// PUT /api/auth/mentees/:uid/meeting-preference
// Owner is the authenticated profile id (never a request-body id). Both fields
// are written atomically; a failed save preserves the previous value.
export const updateMenteeMeetingPreference = asyncHandler(async (req, res) => {
  const uid = firstParam(req.params.uid);
  if (!uid) {
    res.status(400).json({ error: "Missing mentee uid" });
    return;
  }

  const body = (req.body ?? {}) as { weekday?: unknown; meetingTime?: unknown };
  const result = await saveMeetingPreference({
    mentorId: req.authUser!.id,
    menteeUid: uid,
    weekday: body.weekday,
    meetingTime: body.meetingTime,
  });

  if (!result.ok) {
    const status =
      result.error.code === "invalid_weekday" || result.error.code === "invalid_time"
        ? 400
        : result.error.code === "not_assigned"
          ? 403
          : 500;
    res.status(status).json({ error: result.error.message });
    return;
  }
  res.json({ data: result.data });
});

// GET /api/auth/mentees/:uid/mcf-prefill
// Fresh click-time prefill for the CURRENT week. Recomposes evidence at
// activation, returns a private/no-store URL, and never submits. Unknown
// sources block the prefill with an actionable error.
export const getMenteeMcfPrefill = asyncHandler(async (req, res) => {
  const uid = firstParam(req.params.uid);
  if (!uid) {
    res.status(400).json({ error: "Missing mentee uid" });
    return;
  }

  const profile = req.profile;
  const mentorFullName =
    profile?.full_name?.trim() ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();

  const result = await getMenteeMcfPrefillForMentor({
    mentorId: req.authUser!.id,
    mentorFullName,
    mentorUid: profile?.student_id ?? null,
    menteeUid: uid,
  });

  if (!result.ok) {
    const status =
      result.error.code === "mentee_not_found"
        ? 404
        : result.error.code === "mentor_uid_unavailable"
          ? 409
          : 503;
    res.status(status).json({ error: result.error.message });
    return;
  }

  res.setHeader("Cache-Control", "private, no-store");
  res.json({ data: result.data });
});
