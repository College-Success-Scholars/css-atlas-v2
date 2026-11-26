/**
 * Every route except the health check refuses a request with no token.
 * Driven by the route inventory, so a new or migrated route is covered
 * without editing a list.
 */
import request from "supertest";
import { describe, expect, it } from "vitest";
import { listRoutes } from "./support/route-inventory.js";
import { app } from "../app.js";

/** The only routes anyone may call without signing in. Adding one is a security decision. */
const PUBLIC_ROUTES = new Set(["GET /"]);

const gated = listRoutes().filter((route) => !PUBLIC_ROUTES.has(`${route.method} ${route.path}`));

describe("route gating", () => {
  it("finds the routes (guards against an empty inventory passing vacuously)", () => {
    expect(gated.length).toBeGreaterThan(40);
  });

  it.each(gated.map((route) => [route.method, route.path] as const))("%s %s answers 401 without a token", async (method, path) => {
    const url = path.replace(/:[A-Za-z_]+/g, "1");
    const res = await request(app)[method.toLowerCase() as "get"](url).send({});
    expect(res.status).toBe(401);
  });
});
