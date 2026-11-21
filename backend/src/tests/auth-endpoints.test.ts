import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const profiles = vi.hoisted(() => ({ getProfileById: vi.fn(), createOwnProfile: vi.fn() }));
const semesters = vi.hoisted(() => ({ getActiveSemesterRow: vi.fn() }));

vi.mock("../services/profile.service.js", () => profiles);
vi.mock("../services/semester.service.js", () => semesters);

import { authEndpoints } from "../controllers/auth.controller.js";
import { semesterEndpoints } from "../controllers/semester.controller.js";
import { errorHandler } from "../http/error-handler.js";

interface FakeSignIn {
  email?: string | null;
  profile?: Record<string, unknown> | null;
  realProfile?: Record<string, unknown> | null;
  activeTestProfileId?: string | null;
  isActingAsTestProfile?: boolean;
}

/** The bound handlers behind a fake sign-in, so validation, error mapping and the envelope are what run. */
function appFor(signIn: FakeSignIn = {}) {
  const api = express();
  api.use(express.json());
  api.use((req, _res, next) => {
    Object.assign(req, {
      authUser: { id: "u-1", email: signIn.email === undefined ? "ada@umd.edu" : signIn.email },
      profile: signIn.profile ?? null,
      realProfile: signIn.realProfile ?? null,
      activeTestProfileId: signIn.activeTestProfileId,
      isActingAsTestProfile: signIn.isActingAsTestProfile,
    });
    next();
  });
  for (const { contract, handle } of [...authEndpoints, ...semesterEndpoints]) {
    api[contract.method.toLowerCase() as "get" | "post"](contract.path, handle);
  }
  api.use(errorHandler);
  return api;
}

beforeEach(() => vi.resetAllMocks());

describe("GET /api/auth/me", () => {
  it("wraps the user and effective profile in { data }", async () => {
    const profile = { id: "u-1", role: "scholar" };
    const res = await request(appFor({ profile, realProfile: profile })).get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { user: { id: "u-1", email: "ada@umd.edu" }, profile } });
  });

  it("answers a null profile before onboarding, and a null email when there is none", async () => {
    const res = await request(appFor({ email: null })).get("/api/auth/me");
    expect(res.body).toEqual({ data: { user: { id: "u-1", email: null }, profile: null } });
  });

  it("adds the real profile and acting-as state for a developer", async () => {
    const real = { id: "u-1", app_role: "developer" };
    const persona = { id: "p-1", role: "scholar" };
    const res = await request(
      appFor({ profile: persona, realProfile: real, activeTestProfileId: "p-1", isActingAsTestProfile: true }),
    ).get("/api/auth/me");
    expect(res.body.data).toEqual({
      user: { id: "u-1", email: "ada@umd.edu" },
      profile: persona,
      realProfile: real,
      activeTestProfileId: "p-1",
      isActingAsTestProfile: true,
    });
  });
});

describe("GET /api/auth/profile", () => {
  it("returns the caller's own row", async () => {
    profiles.getProfileById.mockResolvedValue({ id: "u-1", first_name: "Ada" });
    const res = await request(appFor()).get("/api/auth/profile");
    expect(profiles.getProfileById).toHaveBeenCalledWith("u-1");
    expect(res.body).toEqual({ data: { id: "u-1", first_name: "Ada" } });
  });

  it("answers 404 when there is no row yet", async () => {
    profiles.getProfileById.mockResolvedValue(null);
    const res = await request(appFor()).get("/api/auth/profile");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Profile not found" });
  });
});

describe("POST /api/auth/profile", () => {
  const body = { first_name: " Ada ", last_name: "Lovelace", student_id: "123456789", cohort: "2025" };

  it("creates the profile with 201, trimming names and numeric strings", async () => {
    profiles.createOwnProfile.mockResolvedValue({ id: "u-1" });
    const res = await request(appFor()).post("/api/auth/profile").send({ ...body, phone_number: " 555 " });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ data: { id: "u-1" } });
    expect(profiles.createOwnProfile).toHaveBeenCalledWith({
      userId: "u-1",
      email: "ada@umd.edu",
      first_name: "Ada",
      last_name: "Lovelace",
      student_id: "123456789",
      phone_number: "555",
      cohort: 2025,
    });
  });

  it("stores a blank phone number as null", async () => {
    profiles.createOwnProfile.mockResolvedValue({ id: "u-1" });
    await request(appFor()).post("/api/auth/profile").send({ ...body, phone_number: "" });
    expect(profiles.createOwnProfile).toHaveBeenCalledWith(expect.objectContaining({ phone_number: null }));
  });

  it("answers 409 when a profile already exists", async () => {
    const res = await request(appFor({ realProfile: { id: "u-1" } })).post("/api/auth/profile").send(body);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "Profile already exists" });
    expect(profiles.createOwnProfile).not.toHaveBeenCalled();
  });

  it.each(["ada@gmail.com", null])("answers 403 for the email %p", async (email) => {
    const res = await request(appFor({ email })).post("/api/auth/profile").send(body);
    expect(res.status).toBe(403);
    expect(profiles.createOwnProfile).not.toHaveBeenCalled();
  });

  it.each([
    { first_name: " " },
    { last_name: undefined },
    { student_id: "abc" },
    { student_id: 0 },
    { cohort: "x" },
    { cohort: 0 },
  ])("rejects %j with 400", async (patch) => {
    const res = await request(appFor()).post("/api/auth/profile").send({ ...body, ...patch });
    expect(res.status).toBe(400);
    expect(profiles.createOwnProfile).not.toHaveBeenCalled();
  });
});

describe("GET /api/auth/semester", () => {
  it("returns the active semester row", async () => {
    const row = { id: 3, iso_week_offset: null, start_date: "2026-08-31", end_date: "2026-12-18" };
    semesters.getActiveSemesterRow.mockResolvedValue(row);
    const res = await request(appFor()).get("/api/auth/semester");
    expect(res.body).toEqual({ data: row });
  });

  it("is a 500 when no semester is active", async () => {
    semesters.getActiveSemesterRow.mockResolvedValue(null);
    const res = await request(appFor()).get("/api/auth/semester");
    expect(res.status).toBe(500);
  });
});
