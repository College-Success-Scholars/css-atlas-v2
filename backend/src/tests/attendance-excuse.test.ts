import { Effect, Exit } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CurrentCaller, type Caller } from "../context/current-caller.js";
import { ValidationError } from "../utils/domain-error.js";

const mocks = vi.hoisted(() => ({ upserted: [] as unknown[], dbError: null as unknown }));

vi.mock("../supabase/client.js", () => ({
  getSupabaseClient: () => ({
    from: () => {
      let row: Record<string, unknown> = {};
      const builder = {
        upsert: (value: Record<string, unknown>) => {
          row = value;
          mocks.upserted.push(value);
          return builder;
        },
        select: () => builder,
        single: async () => (mocks.dbError ? { data: null, error: mocks.dbError } : { data: row, error: null }),
      };
      return builder;
    },
  }),
}));

// The real calendar extrapolates every week >= 1; stub one week as "outside" to reach that branch.
vi.mock("../services/time.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/time.service.js")>();
  return {
    ...actual,
    campusWeekToDateRange: (week: number) => (week === 999 ? null : actual.campusWeekToDateRange(week)),
  };
});

import { upsertExcuse } from "../services/attendance-week.service.js";

const caller: Caller = {
  userId: "auth-user-1",
  actorId: "117000001",
  profile: null,
  realProfile: null,
  asOf: new Date("2026-09-03T14:00:00.000Z"),
};

/** The whole test seam: supply the caller. */
const run = <A, E>(effect: Effect.Effect<A, E, CurrentCaller>) =>
  Effect.runPromiseExit(Effect.provideService(effect, CurrentCaller, caller));

const excuse = { scholar_uid: "117000099", week_num: 2, kind: "front_desk" as const, excuse_min: 60, description: "Sick" };

beforeEach(() => {
  mocks.upserted = [];
  mocks.dbError = null;
});

describe("upsertExcuse", () => {
  it("records who made the change and when, from CurrentCaller", async () => {
    const exit = await run(upsertExcuse(excuse));
    expect(Exit.isSuccess(exit)).toBe(true);
    expect(mocks.upserted[0]).toMatchObject({
      scholar_uid: "117000099",
      updated_by: "117000001",
      updated_at: "2026-09-03T14:00:00.000Z",
    });
  });

  it("fails with a ValidationError for a week outside the campus calendar, without writing", async () => {
    const exit = await run(upsertExcuse({ ...excuse, week_num: 999 }));
    expect(exit).toEqual(Exit.fail(new ValidationError({ field: "week_num", message: "is outside the campus calendar" })));
    expect(mocks.upserted).toEqual([]);
  });

  it("treats a database error as a defect, not a domain failure", async () => {
    mocks.dbError = { code: "23505", message: "duplicate key" };
    const exit = await run(upsertExcuse(excuse));
    expect(Exit.isFailure(exit) && exit.cause.reasons.every((reason) => reason._tag === "Die")).toBe(true);
  });
});
