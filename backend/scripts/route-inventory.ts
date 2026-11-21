/**
 * Prints every mounted Express route as `METHOD PATH ACCESS`, sorted, one per
 * line. Path parameters print as `:` so renaming one is not a change.
 *
 *   npx tsx scripts/route-inventory.ts > routes.txt
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

const { app } = await import("../src/app.js");
const auth = await import("../src/middleware/auth.middleware.js");

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
const lines: string[] = [];

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
    const path = join(prefix, entry.path).replace(/:[A-Za-z_]+/g, ":");
    for (const layer of entry.route.stack) {
      if (!layer.method) continue;
      const handlers = entry.route.stack.map((l) => l.handle);
      lines.push(`${layer.method.toUpperCase()} ${path} ${accessOf([...gates, ...handlers])}`);
    }
  }
}

walk((app as unknown as { router: object }).router, "/", []);
console.log([...new Set(lines)].sort().join("\n"));
