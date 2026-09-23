/**
 * @file user.controller.ts
 * @module backend/controllers
 *
 * Request handlers for user/scholar data endpoints (/api/users/*).
 * Each handler validates request inputs and delegates to user.service.ts.
 *
 * ## Responsibilities
 * - Parse and validate request params/body for user endpoints
 * - Call user.service.ts functions and return { data } or { error } JSON
 *
 * ## What belongs here
 * - Handler functions for /api/users/* routes
 *
 * ## What does NOT belong here
 * - Supabase queries (those are in user.service.ts)
 * - Business logic beyond input validation
 */
import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import {
  fetchScholarNamesByUids,
  fetchRequiredHoursByUids,
  fetchEligibleScholarUids,
  fetchAllUserUids,
  fetchAllUsersForMemo,
  fetchTeamLeaders,
  fetchScholarUids,
  getDirectory,
  getDirectoryFacets,
  DirectoryCursorError,
  getUserByUid,
} from "../services/user.service.js";
import type { DirectoryQuery } from "../models/user.model.js";

const DIRECTORY_PAGE_SIZE = 24;

type QueryValue = unknown;
type DirectoryQueryParams = Record<string, QueryValue>;

function singleValue(value: QueryValue): string | null | undefined {
  if (Array.isArray(value)) return undefined;
  if (value === undefined) return null;
  return typeof value === "string" ? value : undefined;
}

function parseFacet(value: QueryValue, maxLength: number): string[] | null {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  if (values.length > DIRECTORY_PAGE_SIZE || values.some((item) => typeof item !== "string")) return null;
  const facet = (values as string[]).flatMap((item) => item.split(",")).map((item) => item.trim());
  if (facet.some((item) => !item || item.length > maxLength)) return null;
  return [...new Set(facet)];
}

/** Parses the deliberately small public query contract for GET /api/users/directory. */
export function parseDirectoryQuery(query: unknown): DirectoryQuery | null {
  if (query == null || typeof query !== "object") return null;
  const q = query as DirectoryQueryParams;
  const allowedKeys = new Set(["view", "search", "sort", "team", "programRole", "cohort", "limit", "cursor", "group"]);
  if (Object.keys(q).some((key) => !allowedKeys.has(key))) return null;

  const rawView = singleValue(q.view);
  const rawSearch = singleValue(q.search);
  const rawSort = singleValue(q.sort);
  const rawLimit = singleValue(q.limit);
  const cursor = singleValue(q.cursor);
  const group = singleValue(q.group);
  if (rawView === undefined || rawSearch === undefined || rawSort === undefined || rawLimit === undefined || cursor === undefined || group === undefined) return null;
  const view = rawView ?? "flat";
  const search = rawSearch ?? "";
  const sort = rawSort ?? "asc";
  const limitValue = rawLimit ?? String(DIRECTORY_PAGE_SIZE);
  if (
    (view !== "flat" && view !== "grouped") ||
    (sort !== "asc" && sort !== "desc") ||
    search.length > 100 ||
    !Number.isInteger(Number(limitValue)) ||
    Number(limitValue) < 1 ||
    Number(limitValue) > DIRECTORY_PAGE_SIZE ||
    (cursor !== null && (!cursor || cursor.length > 500)) ||
    (group !== null && (!group.trim() || group.length > 100))
  ) return null;

  const teams = parseFacet(q.team, 100);
  const programRoles = parseFacet(q.programRole, 100);
  const cohortValues = parseFacet(q.cohort, 4);
  if (!teams || !programRoles || !cohortValues) return null;
  const cohorts = cohortValues.map((value) => Number(value));
  if (cohorts.some((cohort) => !Number.isInteger(cohort) || cohort < 1900 || cohort > 3000)) return null;
  if ((view === "flat" && group !== null) || (view === "grouped" && cursor !== null && group === null)) return null;

  return {
    view,
    search: search.trim(),
    sort,
    teams,
    programRoles,
    cohorts,
    limit: Number(limitValue),
    cursor,
    group: group?.trim() ?? null,
  };
}

// POST /api/users/scholar-names
export async function scholarNames(req: AuthenticatedRequest, res: Response) {
  try {
    const { uids } = req.body as { uids?: string[] };
    if (!Array.isArray(uids)) { res.status(400).json({ error: "uids must be an array" }); return; }
    const result = await fetchScholarNamesByUids(uids);
    res.json({ data: Object.fromEntries(result) });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch scholar names" });
  }
}

// POST /api/users/required-hours
export async function requiredHours(req: AuthenticatedRequest, res: Response) {
  try {
    const { uids } = req.body as { uids?: string[] };
    if (!Array.isArray(uids)) { res.status(400).json({ error: "uids must be an array" }); return; }
    const result = await fetchRequiredHoursByUids(uids);
    res.json({ data: Object.fromEntries(result) });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch required hours" });
  }
}

// POST /api/users/eligible-scholars
export async function eligibleScholars(req: AuthenticatedRequest, res: Response) {
  try {
    const { uids } = req.body as { uids?: string[] };
    if (!Array.isArray(uids)) { res.status(400).json({ error: "uids must be an array" }); return; }
    const result = await fetchEligibleScholarUids(uids);
    res.json({ data: Array.from(result) });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch eligible scholars" });
  }
}

// GET /api/users/all-uids
export async function allUids(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await fetchAllUserUids();
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch all uids" });
  }
}

// GET /api/users/memo-users
export async function memoUsers(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await fetchAllUsersForMemo();
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch memo users" });
  }
}

// GET /api/users/team-leaders
export async function teamLeaders(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await fetchTeamLeaders();
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch team leaders" });
  }
}

// GET /api/users/scholar-uids
export async function scholarUids(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await fetchScholarUids();
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch scholar uids" });
  }
}

// GET /api/users/directory
export async function directory(req: AuthenticatedRequest, res: Response) {
  const query = parseDirectoryQuery(req.query);
  if (!query) { res.status(400).json({ error: "Invalid directory query" }); return; }
  try {
    res.json({ data: await getDirectory(query) });
  } catch (e) {
    if (e instanceof DirectoryCursorError) {
      res.status(400).json({ error: "Invalid directory cursor" });
      return;
    }
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch directory" });
  }
}

// GET /api/users/directory/facets
export async function directoryFacets(req: AuthenticatedRequest, res: Response) {
  try {
    res.json({ data: await getDirectoryFacets() });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch directory facets" });
  }
}

// GET /api/users/:uid
export async function getByUid(req: AuthenticatedRequest, res: Response) {
  try {
    const uid = Array.isArray(req.params.uid) ? req.params.uid[0] : req.params.uid;
    if (!uid) { res.status(400).json({ error: "Missing uid parameter" }); return; }
    const data = await getUserByUid(uid);
    if (!data) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch user" });
  }
}
