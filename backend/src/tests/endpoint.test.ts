import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as attendance from "@css-atlas/shared/contracts/attendance";
import { download, endpoint, Schema } from "@css-atlas/shared/contract";
import { Context, Effect } from "effect";
import { CurrentCaller } from "../context/current-caller.js";
import { implement, type Caller, type Handler } from "../http/endpoint.js";
import { errorHandler } from "../http/error-handler.js";
import { ConflictError, ForbiddenError, NotFoundError, UnavailableError } from "../utils/domain-error.js";

/** Mount a bound endpoint without the auth middleware, so only the request lifecycle is under test. */
function appFor(bound: ReturnType<typeof implement>) {
  const app = express();
  app.use(express.json());
  const method = bound.contract.method.toLowerCase() as "get" | "patch";
  app[method](bound.contract.path, bound.handle);
  app.use(errorHandler);
  return app;
}

const board = (week_num: number, kind: attendance.AttendanceKind) => ({
  week_num,
  week_start: "2026-08-31",
  kind,
  rows: [],
  summary: { scholar_count: 0, at_or_above_90: 0, below_75: 0 },
});

const excuseRow = {
  scholar_uid: "123",
  week_start: "2026-08-31",
  week_num: 1,
  kind: "front_desk" as const,
  excuse_min: 30,
  description: "Sick",
  updated_by: null,
  updated_at: "2026-09-01T00:00:00.000Z",
};

afterEach(() => vi.restoreAllMocks());

describe("implement — request lifecycle", () => {
  it("passes validated, coerced input to the handler and wraps the result in { data }", async () => {
    const handler = vi.fn<Handler<typeof attendance.getWeekBoard>>(async ({ params, query }) =>
      board(params.week_num, query.kind),
    );
    const res = await request(appFor(implement(attendance.getWeekBoard, handler))).get(
      "/api/attendance/week/7?kind=study_session",
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: board(7, "study_session") });
    expect(handler.mock.calls[0]?.[0].params.week_num).toBe(7);
  });

  it("gives the handler the request time, read once at the edge", async () => {
    let caller: Caller | undefined;
    const bound = implement(attendance.getWeekBoard, async ({ params, query }, who) => {
      caller = who;
      return board(params.week_num, query.kind);
    });
    await request(appFor(bound)).get("/api/attendance/week/1?kind=front_desk");
    expect(caller?.asOf).toBeInstanceOf(Date);
  });

  it.each([
    ["/api/attendance/week/0?kind=front_desk", "week_num must be a campus week number of 1 or more"],
    ["/api/attendance/week/abc?kind=front_desk", "week_num must be a whole number"],
  ])("rejects a bad path parameter with 400 and never calls the handler (%s)", async (url, error) => {
    const handler = vi.fn();
    const res = await request(appFor(implement(attendance.getWeekBoard, handler))).get(url);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error });
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects a missing or unknown query value with 400 naming the field", async () => {
    const app = appFor(implement(attendance.getWeekBoard, vi.fn()));
    for (const url of ["/api/attendance/week/1", "/api/attendance/week/1?kind=study"]) {
      const res = await request(app).get(url);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/^kind /);
    }
  });

  it("rejects a body that breaks a cross-field rule with 400", async () => {
    const handler = vi.fn();
    const res = await request(appFor(implement(attendance.upsertExcuse, handler)))
      .patch("/api/attendance/excuse")
      .send({ scholar_uid: "123", week_num: 1, kind: "front_desk", excuse_min: 30, description: "  " });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "description is required when excuse_min is greater than 0" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("normalises the body before the handler sees it", async () => {
    const handler = vi.fn<Handler<typeof attendance.upsertExcuse>>(async () => excuseRow);
    await request(appFor(implement(attendance.upsertExcuse, handler)))
      .patch("/api/attendance/excuse")
      .send({ scholar_uid: " 123 ", week_num: "1", kind: "front_desk", excuse_min: 30, description: " Sick " });
    expect(handler.mock.calls[0]?.[0].body).toEqual({
      scholar_uid: "123",
      week_num: 1,
      kind: "front_desk",
      excuse_min: 30,
      description: "Sick",
    });
  });

  it("maps a domain error thrown by a Promise handler to its status", async () => {
    const bound = implement(attendance.getWeekBoard, async () => {
      throw new NotFoundError({ resource: "Campus week", id: "1" });
    });
    const res = await request(appFor(bound)).get("/api/attendance/week/1?kind=front_desk");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Campus week "1" not found' });
  });

  it("hides unexpected errors behind a 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const bound = implement(attendance.getWeekBoard, async () => {
      throw new Error("connection string leaked");
    });
    const res = await request(appFor(bound)).get("/api/attendance/week/1?kind=front_desk");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
  });

  it("drops fields the contract does not declare", async () => {
    const bound = implement(attendance.getWeekBoard, async ({ params, query }) => ({
      ...board(params.week_num, query.kind),
      internal_note: "do not ship",
    }));
    const res = await request(appFor(bound)).get("/api/attendance/week/1?kind=front_desk");
    expect(res.body.data).not.toHaveProperty("internal_note");
  });

  it("answers 500 when a handler returns data that breaks the contract", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = (async () => ({ week_num: 1 })) as unknown as Handler<typeof attendance.getWeekBoard>;
    const res = await request(appFor(implement(attendance.getWeekBoard, handler))).get(
      "/api/attendance/week/1?kind=front_desk",
    );
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
  });
});

describe("implement — Effect handlers", () => {
  it("provides CurrentCaller to the handler and everything it calls", async () => {
    const recordedBy = Effect.gen(function* () {
      const { actorId } = yield* CurrentCaller;
      return actorId;
    });
    const bound = implement(attendance.getWeekBoard, ({ params, query }) =>
      Effect.gen(function* () {
        const actor = yield* recordedBy;
        return { ...board(params.week_num, query.kind), week_start: actor ?? "anonymous" };
      }),
    );
    const res = await request(appFor(bound)).get("/api/attendance/week/2?kind=front_desk");
    expect(res.status).toBe(200);
    expect(res.body.data.week_start).toBe("anonymous");
  });

  it.each([
    [new ForbiddenError({ reason: "Only your own mentees" }), 403, "Only your own mentees"],
    [new ConflictError({ message: "The week is locked" }), 409, "The week is locked"],
    [new UnavailableError({ message: "PDF generation failed. Please try again." }), 503, "PDF generation failed. Please try again."],
  ])("maps a typed failure to its status (%s)", async (failure, status, error) => {
    const bound = implement(attendance.getWeekBoard, () => Effect.fail(failure));
    const res = await request(appFor(bound)).get("/api/attendance/week/1?kind=front_desk");
    expect(res.status).toBe(status);
    expect(res.body).toEqual({ error });
  });

  it("turns a defect into a 500 without leaking it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const bound = implement(attendance.getWeekBoard, () => Effect.die(new Error("db password in message")));
    const res = await request(appFor(bound)).get("/api/attendance/week/1?kind=front_desk");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
  });

  it("rejects, at compile time, handlers it cannot run", () => {
    class Mailer extends Context.Service<Mailer, { send: () => void }>()("Mailer") {}

    // @ts-expect-error a requirement other than CurrentCaller is never provided
    implement(attendance.getWeekBoard, () => Effect.gen(function* () { yield* Mailer; return board(1, "front_desk"); }));

    // @ts-expect-error only DomainError failures map to a status
    implement(attendance.getWeekBoard, () => Effect.fail(new Error("untyped")));

    expect(true).toBe(true);
  });
});

describe("implement — contract options", () => {
  const profileGate = (profile: Record<string, unknown> | null) => (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as express.Request & { profile?: unknown }).profile = profile;
    next();
  };
  function mount(bound: ReturnType<typeof implement>, profile: Record<string, unknown> | null = null) {
    const app = express();
    app.use(express.json());
    const method = bound.contract.method.toLowerCase() as "get" | "post";
    app[method](bound.contract.path, profileGate(profile), bound.handle);
    app.use(errorHandler);
    return app;
  }

  const ownData = endpoint({
    method: "GET",
    path: "/api/scholars/:uid/thing",
    access: { selfOrTeamLeader: "params.uid" },
    params: Schema.Struct({ uid: Schema.String }),
    output: Schema.Struct({ uid: Schema.String }),
  });
  const echoUid = implement(ownData, async ({ params }) => ({ uid: params.uid }));

  it.each([
    ["their own data", { app_role: "scholar", student_id: "111" }, "111", 200],
    ["another scholar's data", { app_role: "scholar", student_id: "111" }, "222", 403],
    ["any scholar's data as a team leader", { app_role: "team_leader", student_id: "999" }, "222", 200],
  ])("self-or-team-leader lets a caller reach %s: %s", async (_label, profile, uid, status) => {
    const res = await request(mount(echoUid, profile)).get(`/api/scholars/${uid}/thing`);
    expect(res.status).toBe(status);
    if (status === 403) expect(res.body).toEqual({ error: "Forbidden: Can only access your own data" });
  });

  it("self-or-team-leader on an optional body field lets an absent ID through to the handler", async () => {
    const lookup = endpoint({
      method: "POST",
      path: "/api/lookup",
      access: { selfOrTeamLeader: "body.scholarId" },
      body: Schema.Struct({ scholarId: Schema.optional(Schema.String) }),
      output: Schema.Struct({ found: Schema.Boolean }),
    });
    const app = mount(implement(lookup, async ({ body }) => ({ found: body.scholarId !== undefined })), {
      app_role: "scholar",
      student_id: "111",
    });
    expect((await request(app).post("/api/lookup").send({})).body).toEqual({ data: { found: false } });
    expect((await request(app).post("/api/lookup").send({ scholarId: "222" })).status).toBe(403);
  });

  it("sends the contract's status and headers", async () => {
    const created = endpoint({
      method: "POST",
      path: "/api/things",
      access: "authenticated",
      status: 201,
      headers: { "Cache-Control": "private, no-store" },
      output: Schema.Struct({ id: Schema.Number }),
    });
    const res = await request(mount(implement(created, async () => ({ id: 7 })))).post("/api/things");
    expect(res.status).toBe(201);
    expect(res.headers["cache-control"]).toBe("private, no-store");
    expect(res.body).toEqual({ data: { id: 7 } });
  });

  it("sends a download as the file itself, not wrapped in { data }", async () => {
    const pdf = download({ method: "GET", path: "/api/report.pdf", access: "team_leader", headers: { "Cache-Control": "no-store" } });
    const bytes = Buffer.from("%PDF-1.7 test");
    const res = await request(mount(implement(pdf, async () => ({ contentType: "application/pdf", filename: "report.pdf", body: bytes }))))
      .get("/api/report.pdf")
      .buffer(true)
      .parse((response, done) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => done(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-disposition"]).toBe('attachment; filename="report.pdf"');
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(Buffer.compare(res.body as Buffer, bytes)).toBe(0);
  });
});
