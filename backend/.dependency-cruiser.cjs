/**
 * Backend import-direction rules. The directory a file lives in decides what
 * it may import:
 *
 *   routes → controllers → services / domains → models, supabase, utils
 *   (http/ is the request lifecycle; only routes, controllers and app.ts use it.
 *    context/ holds CurrentCaller; every layer may import it.)
 *
 * Existing violations are grandfathered in .dependency-cruiser-known-violations.json
 * (may only shrink). See docs/dev/guardrails.md.
 */
const rule = (name, comment, from, to) => ({ name, severity: "error", comment, from, to });

module.exports = {
  forbidden: [
    rule("no-circular", "Import cycles hide the real dependency direction.", {}, { circular: true }),
    rule(
      "routes-only-wire-controllers",
      "Routes mount middleware and controllers. They never reach services, domains or Supabase.",
      { path: "^src/routes/" },
      { path: "^src/(services|domains|supabase|models)/" },
    ),
    rule(
      "controllers-never-query-supabase",
      "Only services (and domains) talk to Supabase. Controllers call a service.",
      { path: "^src/controllers/" },
      { path: "^src/supabase/client" },
    ),
    rule(
      "no-upward-imports",
      "Services, domains, models and utils never import the HTTP edge.",
      { path: "^src/(services|domains|models|utils|supabase)/" },
      { path: "^src/(routes|controllers|http)/" },
    ),
    rule(
      "no-express-below-controllers",
      "Express types stop at controllers and middleware.",
      { path: "^src/(services|domains|models|supabase)/" },
      { path: "node_modules/(express|@types/express)/" },
    ),
    rule(
      "models-are-leaves",
      "Models hold types and constants. They import nothing above them.",
      { path: "^src/models/" },
      { path: "^src/(services|domains|controllers|routes|middleware)/" },
    ),
    rule(
      "context-is-a-leaf",
      "context/ describes the current request (CurrentCaller). Every layer may read it, so it imports nothing above models.",
      { path: "^src/context/" },
      { path: "^src/(routes|controllers|http|middleware|services|domains|supabase)/" },
    ),
    rule(
      "services-never-import-domains",
      "A domain may use shared services; shared services never depend on a domain's internals.",
      { path: "^src/services/" },
      { path: "^src/domains/" },
    ),
    rule(
      "domains-are-isolated",
      "One domain never imports another domain's files.",
      { path: "^src/domains/([^/]+)/" },
      { path: "^src/domains/[^/]+/", pathNot: "^src/domains/$1/" },
    ),
    rule(
      "no-test-imports-in-source",
      "Production code never imports test code.",
      { pathNot: "(^src/tests/|\\.test\\.ts$|__manual_test__)" },
      { path: "(^src/tests/|\\.test\\.ts$|__manual_test__)" },
    ),
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^dist/|^\\.\\./shared/)" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
  },
};
