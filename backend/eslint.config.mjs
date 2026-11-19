/**
 * Backend guardrails. Every rule here is categorical: it bans a pattern
 * outright rather than asking for judgement. Files that predate a rule are
 * grandfathered in eslint-baseline.json, which may only shrink
 * (`npm run lint:baseline`). See docs/dev/guardrails.md.
 */
import { readFileSync } from "node:fs";
import tseslint from "typescript-eslint";
import atlas, { baselineOverrides } from "../tools/eslint-plugin-atlas/index.mjs";

const baseline = JSON.parse(readFileSync(new URL("./eslint-baseline.json", import.meta.url), "utf8"));

const TESTS = ["src/tests/**", "src/**/*.test.ts", "src/**/__manual_test__/**"];

export default [
  { ignores: ["dist/**", "node_modules/**", "src/supabase/database.types.ts"] },
  {
    files: ["src/**/*.ts"],
    languageOptions: { parser: tseslint.parser },
    plugins: { "@typescript-eslint": tseslint.plugin, atlas },
    linterOptions: { reportUnusedDisableDirectives: "error" },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": "error",
      "atlas/no-enum": "error",
      "atlas/no-schema-library": "error",
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["**/shared/dist/**", "../**/shared/*"], message: "Import shared code by package name: @css-atlas/shared/<module>." },
        ],
      }],
    },
  },
  {
    files: ["src/**/*.ts"],
    ignores: TESTS,
    rules: {
      "atlas/no-double-cast": "error",
      "atlas/no-dynamic-import": "error",
      "atlas/no-process-env": "error",
    },
  },
  {
    // The clock is read at the edge (controllers, cron entrypoints) and passed down as `asOf`.
    files: ["src/services/**", "src/models/**", "src/utils/**", "src/domains/**"],
    ignores: TESTS,
    rules: { "atlas/no-clock-read": "error" },
  },
  {
    // Effects are values until the edge runs them.
    files: ["src/**/*.ts"],
    ignores: [...TESTS, "src/http/**"],
    rules: { "atlas/no-effect-run": "error" },
  },
  {
    // Controllers are handlers bound to a contract: no Express, no catching.
    files: ["src/controllers/**"],
    rules: { "atlas/no-try-catch": "error", "atlas/no-express-import": "error" },
  },
  ...baselineOverrides(baseline),
];
