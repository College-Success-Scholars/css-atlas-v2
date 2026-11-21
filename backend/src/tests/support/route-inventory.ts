/**
 * Lists every mounted Express route with its access level.
 *
 *   npm run routes > routes.txt      (scripts/route-inventory.ts)
 *
 * Patches the router to record registrations, so import it only from tests
 * and scripts, never from application code. As a script it prints `METHOD PATH ACCESS`, sorted, one per line, with path
 * parameters as `:` so renaming one is not a change. As a module,
 * `listRoutes()` returns the routes with real paths (src/tests/route-gating.test.ts).
 *
 * Used to prove a refactor keeps every route at the same method, path and
 * access level: diff the output before and after. Loads the app without
 * starting a server, so it needs no env vars, token or database.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
type Fn = (...args: unknown[]) => unknown;
type Entry = { kind: "use"; path: string; fns: Fn[] } | { kind: "route"; path: string; route: { stack: { method?: string; handle: Fn }[] } };
const Router = require("router") as { prototype: Record<string, Fn> };
const entries = new WeakMap<object, Entry[]>();
const entriesOf = (router: object) => {
  if (!entries.has(router)) entries.set(router, []);
  return entries.get(router)!;
};

const originalUse = Router.prototype.use!;
Router.prototype.use = function (this: object, ...args: unknown[]) {
  const path = typeof args[0] === "string" ? (args.shift() as string) : "/";
  entriesOf(this).push({ kind: "use", path, fns: (args.flat(Infinity) as Fn[]) });
  return originalUse.apply(this, [path, ...args]);
};
const originalRoute = Router.prototype.route!;
Router.prototype.route = function (this: object, path: unknown) {
  const route = originalRoute.call(this, path) as Entry & { stack: never };
  entriesOf(this).push({ kind: "route", path: String(path), route: route as never });
  return route;
};

export interface RouteInfo {
  method: string;
  /** Express path with its parameter names, e.g. /api/tutor-reports/week/:week_num */
  path: string;
  access: string;
}

const { app } = await import("../../app.js");
const auth = await import("../../middleware/auth.middleware.js");

/** Higher rank wins when a route passes through several gates. */
const ACCESS = new Map<unknown, [number, string]>([
  [auth.requireAuth, [1, "authenticated"]],
  [auth.requireTeamLeaderOrAbove, [3, "team_leader"]],
  [auth.requireTeamLeaderRole, [3, "team_leader"]],
  [auth.requireSelfOrTeamLeader, [2, "self_or_team_leader(params.uid)"]],
  [auth.requireSelfScholarIdOrTeamLeader, [2, "self_or_team_leader(body.scholarId)"]],
  [auth.requireDeveloper, [4, "developer"]],
]);

function accessOf(fns: Fn[]): string {
  let best: [number, string] = [0, "public"];
  for (const fn of fns) {
    const tagged = (fn as { access?: [number, string] }).access ?? ACCESS.get(fn);
    if (tagged && tagged[0] >= best[0]) best = tagged;
  }
  return best[1];
}

const join = (a: string, b: string) => `/${[a, b].join("/").split("/").filter(Boolean).join("/")}`;
const routes: RouteInfo[] = [];

function walk(router: object, prefix: string, inherited: Fn[]) {
  const gates = [...inherited];
  for (const entry of entriesOf(router)) {
    if (entry.kind === "use") {
      for (const fn of entry.fns) {
        if (entries.has(fn)) walk(fn, join(prefix, entry.path), gates);
        else if (entry.path === "/") gates.push(fn);
      }
      continue;
    }
    const path = join(prefix, entry.path);
    // Each handler on a route is its own layer carrying the method, so take each method once.
    const handlers = entry.route.stack.map((l) => l.handle);
    for (const method of new Set(entry.route.stack.flatMap((l) => (l.method ? [l.method] : [])))) {
      routes.push({ method: method.toUpperCase(), path, access: accessOf([...gates, ...handlers]) });
    }
  }
}

walk((app as unknown as { router: object }).router, "/", []);

export const listRoutes = (): readonly RouteInfo[] => routes;

/** Routes as `METHOD PATH ACCESS` lines, parameters shown as `:`, sorted. */
export function inventoryLines(): string[] {
  const lines = routes.map((r) => `${r.method} ${r.path.replace(/:[A-Za-z_]+/g, ":")} ${r.access}`);
  return [...new Set(lines)].sort();
}
