/**
 * Frontend import-direction rules. The directory a file lives in decides what
 * it may import:
 *
 *   app/<route> → components → lib, hooks → shared
 *
 * Existing violations are grandfathered in .dependency-cruiser-known-violations.json
 * (may only shrink). See docs/dev/guardrails.md.
 */
const rule = (name, comment, from, to) => ({ name, severity: "error", comment, from, to });

module.exports = {
  forbidden: [
    rule("no-circular", "Import cycles hide the real dependency direction.", {}, { circular: true }),
    rule(
      "nothing-imports-app",
      "components/, lib/ and hooks/ are below app/. Move shared code down instead of importing a route.",
      { path: "^(components|lib|hooks)/" },
      { path: "^app/" },
    ),
    rule(
      "lib-is-below-components",
      "lib/ and hooks/ never import components/.",
      { path: "^(lib|hooks)/" },
      { path: "^components/" },
    ),
    rule(
      "dashboard-routes-are-isolated",
      "A dashboard route never imports another route's files. Shared code moves to components/ or lib/.",
      { path: "^app/dashboard/([^/]+)/" },
      { path: "^app/dashboard/[^/]+/", pathNot: "^app/dashboard/$1/" },
    ),
    rule(
      "dev-pages-are-not-a-library",
      "app/dev is a scratchpad. Product routes never import from it.",
      { path: "^app/", pathNot: "^app/dev/" },
      { path: "^app/dev/" },
    ),
    rule("no-legacy", "frontend/legacy is dead code.", { pathNot: "^legacy/" }, { path: "^legacy/" }),
    rule("no-backend-source", "The frontend never imports backend source.", {}, { path: "backend/src/" }),
    rule(
      "no-test-imports-in-source",
      "Production code never imports test code.",
      { pathNot: "(\\.test\\.tsx?$|test-helpers|^scripts/)" },
      { path: "(\\.test\\.tsx?$|test-helpers)" },
    ),
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^\\.next/|^legacy/|^\\.\\./shared/)" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
  },
};
