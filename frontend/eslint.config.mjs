import { dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import { FlatCompat } from "@eslint/eslintrc";
import atlas, { baselineOverrides } from "../tools/eslint-plugin-atlas/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// Guardrails: categorical bans. Files that predate a rule are grandfathered in
// eslint-baseline.json, which may only shrink (`npm run lint:baseline`).
// See docs/dev/guardrails.md.
const baseline = JSON.parse(readFileSync(new URL("./eslint-baseline.json", import.meta.url), "utf8"));
const SOURCE = ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "hooks/**/*.{ts,tsx}"];
const TESTS = ["**/*.test.{ts,tsx}", "**/*.test-helpers.ts", "**/mock-data.ts"];

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      // Disable unused variable rules
      "@typescript-eslint/no-unused-vars": "off",
      "no-unused-vars": "off",
    },
  },
  {
    files: SOURCE,
    plugins: { atlas },
    linterOptions: { reportUnusedDisableDirectives: "error" },
    rules: {
      "atlas/no-enum": "error",
      "atlas/no-schema-library": "error",
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["**/backend/src/**"], message: "The frontend never imports backend source. Share code through shared/." },
          { group: ["**/shared/dist/**", "../**/shared/*"], message: "Import shared code by package name: @css-atlas/shared/<module>." },
        ],
      }],
    },
  },
  {
    files: SOURCE,
    ignores: TESTS,
    rules: {
      "atlas/no-double-cast": "error",
      "atlas/no-process-env": "error",
      "atlas/no-supabase-query": "error",
      "atlas/no-clock-read": "error",
      "atlas/no-use-effect": "error",
      "atlas/no-raw-fetch": "error",
    },
  },
  {
    // Effects and clock reads live in named hooks.
    files: ["hooks/**"],
    rules: { "atlas/no-use-effect": "off", "atlas/no-clock-read": "off" },
  },
  {
    // The two API client modules are the only callers of fetch().
    files: ["lib/client/api-client.ts", "lib/server/api-client.ts"],
    rules: { "atlas/no-raw-fetch": "off" },
  },
  ...baselineOverrides(baseline),
];

export default eslintConfig;
