/**
 * Pre-commit checks, run by husky (.husky/pre-commit) on staged files only.
 * ESLint runs inside each workspace so it picks up that package's eslint.config.mjs
 * and its baseline. CI runs the full guardrails; this is the fast first line.
 */
const quote = (files) => files.map((file) => JSON.stringify(file)).join(" ");
const eslintIn = (workspace) => (files) =>
  `npm exec -w ${workspace} -- eslint --fix --no-warn-ignored ${quote(files)}`;

export default {
  "frontend/**/*.{ts,tsx,mjs}": eslintIn("@css-atlas/frontend"),
  "backend/**/*.{ts,mjs}": eslintIn("@css-atlas/backend"),
  "{scripts,tools}/**/*.mjs": (files) => files.map((file) => `node --check ${JSON.stringify(file)}`),
};
