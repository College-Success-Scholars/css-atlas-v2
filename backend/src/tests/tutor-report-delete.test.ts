import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const mocks = vi.hoisted(() => ({
  appRole: "team_leader" as string,
  deleteEq: vi.fn(),
  deletedRows: [{ id: 42 }] as { id: number }[],
}));

vi.mock("../supabase/client.js", () => {
  const profilesBuilder = {
    select: () => profilesBuilder,
    eq: () => profilesBuilder,
    maybeSingle: async () => ({
      data: { id: "user-1", app_role: mocks.appRole, user_roster: null },
      error: null,
    }),
  };
  const tutorBuilder = {
    delete: () => tutorBuilder,
    eq: (column: string, value: unknown) => {
      mocks.deleteEq(column, value);
      return tutorBuilder;
    },
    select: async () => ({ data: mocks.deletedRows, error: null }),
  };
  const client = {
    from: (table: string) => (table === "profiles" ? profilesBuilder : tutorBuilder),
  };
  return {
    runWithToken: (_token: string, fn: () => unknown) => fn(),
    getSupabaseClient: () => client,
    getSupabaseAuthClient: () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1", email: "tl@example.com" } }, error: null }),
      },
    }),
    getSupabaseServiceRoleClient: () => client,
  };
});

import { app } from "../app.js";

describe("DELETE /api/tutor-reports/:id", () => {
  beforeEach(() => {
    mocks.appRole = "team_leader";
    mocks.deletedRows = [{ id: 42 }];
    mocks.deleteEq.mockClear();
  });

  it("returns 401 without a token", async () => {
    const res = await request(app).delete("/api/tutor-reports/42");
    expect(res.status).toBe(401);
    expect(mocks.deleteEq).not.toHaveBeenCalled();
  });

  it("deletes one row for a team leader", async () => {
    const res = await request(app)
      .delete("/api/tutor-reports/42")
      .set("Authorization", "Bearer tl-token");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { id: 42 } });
    expect(mocks.deleteEq).toHaveBeenCalledWith("id", 42);
  });

  it("rejects a scholar with 403 before touching the table", async () => {
    mocks.appRole = "scholar";
    const res = await request(app)
      .delete("/api/tutor-reports/42")
      .set("Authorization", "Bearer scholar-token");
    expect(res.status).toBe(403);
    expect(mocks.deleteEq).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-numeric id", async () => {
    const res = await request(app)
      .delete("/api/tutor-reports/abc")
      .set("Authorization", "Bearer tl-token");
    expect(res.status).toBe(400);
    expect(mocks.deleteEq).not.toHaveBeenCalled();
  });

  it("returns 404 when no row was deleted", async () => {
    mocks.deletedRows = [];
    const res = await request(app)
      .delete("/api/tutor-reports/999")
      .set("Authorization", "Bearer tl-token");
    expect(res.status).toBe(404);
  });
});
