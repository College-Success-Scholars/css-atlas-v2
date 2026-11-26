/**
 * For each route in the inventory, count the frontend files that reference its
 * path (path parameters match any `${...}` expression or literal segment).
 *
 *   npm run -s routes | node scripts/route-callers.mjs
 *
 * Prints `CALLERS METHOD PATH ACCESS` with the matching files. A hit inside a
 * wrapper module (lib/server/data.ts, lib/client/api-client.ts) counts only if
 * that wrapper function is itself used elsewhere; it prints as `fn->N`.
 * A route with 0 callers has no consumer: the frontend is the API's only
 * client. Dynamic segments (`/api/form-logs/${type}/...`) are reported as
 * `maybe:` so a human checks them; they never count as a definite caller.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("../../frontend/", import.meta.url).pathname;
const skip = new Set(["node_modules", ".next", "public"]);
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push([relative(root, full), readFileSync(full, "utf8")]);
  }
})(root);

const segment = String.raw`(?:\$\{[^}]+\}|[^/"'\`?\s]+)`;
const WRAPPERS = new Set(["lib/server/data.ts", "lib/client/api-client.ts", "lib/server/api-client.ts"]);

/** Names of exported functions in `text` whose body contains a match of `re`. */
function enclosingFunctions(text, re) {
  const names = [];
  const starts = [...text.matchAll(/export (?:async )?function (\w+)/g)];
  starts.forEach((m, i) => {
    const body = text.slice(m.index, starts[i + 1]?.index ?? text.length);
    if (re.test(body)) names.push(m[1]);
  });
  return names;
}

const usedElsewhere = (name, except) =>
  files.filter(([file, text]) => file !== except && new RegExp(`\\b${name}\\b`).test(text)).length;
const lines = readFileSync(0, "utf8").trim().split("\n");
for (const line of lines) {
  const [method, path, access] = line.split(" ");
  if (path === "/") continue;
  const pattern = path
    .split("/")
    .map((part) => (part === ":" ? segment : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/");
  const re = new RegExp(`["'\`]${pattern}(?:["'\`?]|\\$\\{)`);
  const notes = [];
  let count = 0;
  for (const [file, text] of files) {
    if (!re.test(text)) continue;
    if (!WRAPPERS.has(file)) { count++; notes.push(file); continue; }
    for (const fn of enclosingFunctions(text, re)) {
      const n = usedElsewhere(fn, file);
      if (n > 0) count++;
      notes.push(`${fn}->${n}`);
    }
  }
  // A dynamic segment where the route has a literal one: a possible caller only.
  const loose = new RegExp(`["'\`]${pattern.split("/").map((p) => (p === segment ? p : `(?:${p}|\\$\\{[^}]+\\})`)).join("/")}(?:["'\`?]|\\$\\{)`);
  const maybe = files.filter(([file, text]) => !re.test(text) && loose.test(text)).map(([file]) => file);
  if (maybe.length) notes.push(`maybe:${maybe.join("|")}`);
  console.log(`${count} ${method} ${path} ${access}${notes.length ? `  ${notes.join(", ")}` : ""}`);
}
