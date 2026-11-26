#!/usr/bin/env node
/**
 * Ratchet for grandfathered lint violations.
 *
 *   node ../tools/lint-baseline.mjs --check    (run from backend/ or frontend/)
 *       Fails if eslint-baseline.json lists a file that no longer violates
 *       the rule — the entry must be deleted so the rule protects that file.
 *   node ../tools/lint-baseline.mjs --write
 *       Rewrites eslint-baseline.json from the current violations. Only use
 *       this to SHRINK the baseline (or when introducing a new rule).
 *
 * New violations are caught by plain `npm run lint`; this script only keeps
 * the grandfather list honest.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const mode = process.argv[2];
if (mode !== "--check" && mode !== "--write") {
  console.error("usage: lint-baseline.mjs --check | --write");
  process.exit(2);
}

const cwd = process.cwd();
const baselinePath = path.join(cwd, "eslint-baseline.json");
const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));

let stdout;
try {
  stdout = execFileSync("npx", ["eslint", "--format", "json"], {
    cwd,
    env: { ...process.env, ATLAS_LINT_NO_BASELINE: "1" },
    maxBuffer: 256 * 1024 * 1024,
    encoding: "utf8",
  });
} catch (error) {
  stdout = error.stdout; // eslint exits 1 when it finds violations
  if (!stdout) throw error;
}

/** ruleId -> sorted list of repo-relative (to the app) files that violate it */
const current = {};
for (const result of JSON.parse(stdout)) {
  const file = path.relative(cwd, result.filePath).split(path.sep).join("/");
  for (const message of result.messages) {
    if (!message.ruleId) continue;
    (current[message.ruleId] ??= new Set()).add(file);
  }
}

if (mode === "--write") {
  const next = Object.fromEntries(
    Object.keys(current).sort().map((rule) => [rule, [...current[rule]].sort()]),
  );
  writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`);
  const total = Object.values(next).reduce((n, files) => n + files.length, 0);
  console.log(`Wrote ${baselinePath}: ${total} grandfathered file/rule pairs.`);
  process.exit(0);
}

const stale = [];
for (const [rule, files] of Object.entries(baseline)) {
  for (const file of files) {
    if (!current[rule]?.has(file)) stale.push(`${rule}  ${file}`);
  }
}
if (stale.length > 0) {
  console.error("These files no longer violate the rule. Remove them from eslint-baseline.json:\n");
  for (const line of stale) console.error(`  ${line}`);
  process.exit(1);
}
const total = Object.values(baseline).reduce((n, files) => n + files.length, 0);
console.log(`Baseline is tight: ${total} grandfathered file/rule pairs, none stale.`);
