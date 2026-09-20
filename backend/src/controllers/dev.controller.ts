/**
 * @file dev.controller.ts
 * @module backend/controllers
 *
 * Request handlers for developer-only diagnostic endpoints (/api/dev/*).
 * These endpoints expose raw or unfiltered data for debugging and operational
 * purposes. Accessible only to users with app_role = "developer".
 *
 * ## Responsibilities
 * - Provide diagnostic endpoints: test, me, form log lookups, test profiles
 * - Developer roster get/update for /dev/profiles
 *
 * ## What belongs here
 * - Handler functions for /api/dev/* routes
 * - Dev-specific data access patterns that do not belong in production routes
 *
 * ## What does NOT belong here
 * - Production-grade endpoints (add those to the appropriate domain routes)
 * - Endpoints accessible to non-developer roles
 */
import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { isDeveloperProfile } from "../../../shared/dist/auth.js";
import { listTestProfiles, getTestProfileById } from "../services/dev-profile.service.js";
import { getMcfFormLogById, getWplFormLogById } from "../services/form-log.service.js";
import { getRosterByUid, updateRosterByUid } from "../services/user.service.js";
import type { RosterPatch } from "../models/user.model.js";

// GET /api/dev/test
export function test(req: AuthenticatedRequest, res: Response) {
  res.json({
    ok: true,
    message: "Developer API test successful",
    user: req.authUser?.email,
    timestamp: new Date().toISOString(),
  });
}

// GET /api/dev/me
export function me(req: AuthenticatedRequest, res: Response) {
  res.json({
    user: {
      id: req.authUser?.id ?? null,
      email: req.authUser?.email ?? null,
    },
    profile: req.realProfile
      ? { app_role: req.realProfile.app_role, email: req.realProfile.emails?.[0] ?? null }
      : null,
    activeTestProfileId: req.activeTestProfileId ?? null,
    isActingAsTestProfile: req.isActingAsTestProfile ?? false,
  });
}

// GET /api/dev/test-profiles
export async function getTestProfiles(_req: AuthenticatedRequest, res: Response) {
  try {
    const data = await listTestProfiles();
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to list test profiles" });
  }
}

// GET /api/dev/test-profiles/:id
export async function getTestProfile(req: AuthenticatedRequest, res: Response) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!id) {
    res.status(400).json({ error: "Missing profile id" });
    return;
  }
  try {
    const data = await getTestProfileById(id);
    if (!data) {
      res.status(404).json({ error: "Test profile not found" });
      return;
    }
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch test profile" });
  }
}

// POST /api/dev/active-profile — validates testProfileId; client sets httpOnly cookie separately
export async function setActiveProfile(req: AuthenticatedRequest, res: Response) {
  const body = req.body as { testProfileId?: string | null };
  const testProfileId = body.testProfileId ?? null;

  if (testProfileId !== null) {
    const profile = await getTestProfileById(testProfileId);
    if (!profile) {
      res.status(404).json({ error: "Test profile not found" });
      return;
    }
  }

  res.json({
    user: { id: req.authUser?.id ?? null, email: req.authUser?.email ?? null },
    profile: req.profile ?? null,
    realProfile: req.realProfile ?? null,
    activeTestProfileId: testProfileId,
    isActingAsTestProfile: testProfileId !== null,
    isDeveloper: isDeveloperProfile(req.realProfile),
  });
}

// ---------------------------------------------------------------------------
// Form logs
// ---------------------------------------------------------------------------

// GET /api/dev/form-logs/:formType/:formId
export async function getFormLog(req: AuthenticatedRequest, res: Response) {
  const formType = req.params.formType as string;
  const formId = req.params.formId as string;

  try {
    if (formType === "mcf") {
      const data = await getMcfFormLogById(formId!);
      if (!data) { res.status(404).json({ error: "MCF submission not found." }); return; }
      res.json({ data }); return;
    }

    if (formType === "wpl") {
      const numericId = Number(formId);
      if (Number.isNaN(numericId)) { res.status(400).json({ error: "Invalid WPL ID." }); return; }
      const data = await getWplFormLogById(numericId);
      if (!data) { res.status(404).json({ error: "WPL submission not found." }); return; }
      res.json({ data }); return;
    }

    res.status(400).json({ error: "Unsupported form type." });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch form log" });
  }
}

const ROSTER_STATUSES = new Set(["enrolled", "inactive", "graduated"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function caughtErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error) {
    const e = error as { message?: unknown; details?: unknown; hint?: unknown };
    const parts = [e.message, e.details, e.hint].filter(
      (part): part is string => typeof part === "string" && part.trim() !== "",
    );
    if (parts.length > 0) return parts.join(" — ");
  }
  return fallback;
}

function optionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw new Error("Expected a string");
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function optionalInt(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw new Error("Expected an integer");
  return n;
}

function optionalNonNegativeInt(value: unknown): number | null | undefined {
  const n = optionalInt(value);
  if (n != null && n < 0) throw new Error("Expected a non-negative integer");
  return n;
}

function optionalStringArray(value: unknown): string[] | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!Array.isArray(value)) throw new Error("Expected an array of strings");
  return uniqueStrings(value);
}

function uniqueStrings(values: unknown[]): string[] {
  return [...new Set(values.map((v) => String(v).trim()).filter(Boolean))];
}

function parseRosterPatch(body: unknown): RosterPatch {
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Body must be an object");
  }
  const raw = body as Record<string, unknown>;
  const patch: RosterPatch = {};
  if ("first_name" in raw) patch.first_name = optionalString(raw.first_name);
  if ("last_name" in raw) patch.last_name = optionalString(raw.last_name);
  if ("phone_number" in raw) patch.phone_number = optionalString(raw.phone_number);
  if ("email" in raw) {
    const email = optionalString(raw.email);
    if (email != null && !EMAIL_RE.test(email)) throw new Error("Invalid email");
    patch.email = email;
  }
  if ("cohort" in raw) patch.cohort = optionalInt(raw.cohort);
  if ("status" in raw) {
    const status = optionalString(raw.status);
    if (status != null && !ROSTER_STATUSES.has(status.toLowerCase())) {
      throw new Error("status must be enrolled, inactive, or graduated");
    }
    patch.status = status == null ? null : status.toLowerCase();
  }
  if ("app_role" in raw) {
    throw new Error("app_role is not writable");
  }
  if ("program_role" in raw) patch.program_role = optionalString(raw.program_role);
  if ("fd_required" in raw) patch.fd_required = optionalNonNegativeInt(raw.fd_required);
  if ("ss_required" in raw) patch.ss_required = optionalNonNegativeInt(raw.ss_required);
  if ("majors" in raw) patch.majors = optionalStringArray(raw.majors);
  if ("minors" in raw) patch.minors = optionalStringArray(raw.minors);
  if ("teams" in raw) patch.teams = optionalStringArray(raw.teams);
  if ("mentee_uids" in raw) patch.mentee_uids = optionalStringArray(raw.mentee_uids);
  return patch;
}

// GET /api/dev/roster/:uid
export async function getRoster(req: AuthenticatedRequest, res: Response) {
  const uid = Array.isArray(req.params.uid) ? req.params.uid[0] : req.params.uid;
  if (!uid) {
    res.status(400).json({ error: "Missing uid parameter" });
    return;
  }
  try {
    const data = await getRosterByUid(uid);
    if (!data) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: caughtErrorMessage(e, "Failed to fetch roster") });
  }
}

// PATCH /api/dev/roster/:uid
export async function patchRoster(req: AuthenticatedRequest, res: Response) {
  const uid = Array.isArray(req.params.uid) ? req.params.uid[0] : req.params.uid;
  if (!uid) {
    res.status(400).json({ error: "Missing uid parameter" });
    return;
  }
  try {
    const patch = parseRosterPatch(req.body);
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "No roster fields to update" });
      return;
    }
    const data = await updateRosterByUid(uid, patch);
    res.json({ data });
  } catch (e) {
    const message = caughtErrorMessage(e, "Failed to update roster");
    if (message === "User not found") {
      res.status(404).json({ error: message });
      return;
    }
    if (message.includes("blocked by RLS")) {
      res.status(403).json({ error: message });
      return;
    }
    const isValidation =
      message.startsWith("Expected") ||
      message.startsWith("status") ||
      message.startsWith("app_role") ||
      message.startsWith("Invalid") ||
      message.startsWith("Body") ||
      message.startsWith("No roster");
    res.status(isValidation ? 400 : 500).json({ error: message });
  }
}
