/**
 * eslint-plugin-atlas — categorical guardrails for CSS Atlas.
 *
 * Each rule bans one source of nuance outright and says what to do instead.
 * Where a rule applies (and which legacy files are grandfathered) is decided
 * by each app's eslint.config.mjs + eslint-baseline.json, not here.
 * See docs/dev/guardrails.md.
 */

/** Build a rule that reports every node matched by one of `selectors`. */
function ban(description, message, selectors) {
  return {
    meta: { type: "problem", docs: { description }, schema: [], messages: { banned: message } },
    create(context) {
      const report = (node) => context.report({ node, messageId: "banned" });
      return Object.fromEntries(selectors.map((selector) => [selector, report]));
    },
  };
}

const rules = {
  "no-clock-read": ban(
    "Ban reading the wall clock inside logic.",
    "Do not read the clock here. Accept the time as a parameter (e.g. `asOf: Date`) and let the caller at the edge supply it.",
    [
      "NewExpression[callee.name='Date'][arguments.length=0]",
      "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    ],
  ),
  "no-process-env": ban(
    "Ban ad-hoc process.env reads.",
    "Do not read process.env here. Configuration is read once, in the app's env module, and passed in.",
    ["MemberExpression[object.name='process'][property.name='env']"],
  ),
  "no-try-catch": ban(
    "Ban try/catch where errors must propagate to one handler.",
    "Do not catch here. Let the error propagate to the shared error handler; throw a typed error if a specific status is needed.",
    ["TryStatement"],
  ),
  "no-double-cast": ban(
    "Ban `as unknown as T`.",
    "Do not cast through `unknown`. Fix the source type (e.g. regenerate database.types.ts) or parse the value.",
    ["TSAsExpression > TSAsExpression[typeAnnotation.type='TSUnknownKeyword']"],
  ),
  "no-enum": ban(
    "Ban TypeScript enums.",
    "Do not use `enum`. Use a string-literal union (optionally with an `as const` array).",
    ["TSEnumDeclaration"],
  ),
  "no-dynamic-import": ban(
    "Ban dynamic import().",
    "Do not use dynamic import(). Import at the top of the file.",
    ["ImportExpression"],
  ),
  "no-use-effect": ban(
    "Ban direct use of React effects outside the hooks directory.",
    "Do not use useEffect/useLayoutEffect here. Fetch data in a Server Component or server action, derive state during render, or use (or add) a named hook in frontend/hooks/.",
    [
      "ImportDeclaration[source.value='react'] ImportSpecifier[imported.name=/^use(Layout|Insertion)?Effect$/]",
      "MemberExpression[object.name='React'][property.name=/^use(Layout|Insertion)?Effect$/]",
    ],
  ),
  "no-raw-fetch": ban(
    "Ban raw fetch() outside the API client modules.",
    "Do not call fetch() directly. Use the typed wrappers in lib/server/data.ts (server) or lib/client/api-client.ts (browser).",
    ["CallExpression[callee.type='Identifier'][callee.name='fetch']"],
  ),
  "no-supabase-query": ban(
    "Ban Supabase table queries outside the backend.",
    "Do not query Supabase tables from the frontend. Add or use an Express endpoint and call it through lib/server/data.ts.",
    ["CallExpression[callee.property.name='from'][arguments.0.type='Literal'][callee.object.name!='Array'][callee.object.name!='Buffer']"],
  ),
};

export default { meta: { name: "eslint-plugin-atlas" }, rules };

/**
 * Turn a baseline ({ ruleId: [files] }) into flat-config blocks that switch
 * each rule off for its grandfathered files only. Set ATLAS_LINT_NO_BASELINE=1
 * to lint as if nothing were grandfathered (used by tools/lint-baseline.mjs).
 */
export function baselineOverrides(baseline) {
  if (process.env.ATLAS_LINT_NO_BASELINE === "1") return [];
  return Object.entries(baseline)
    .filter(([, files]) => files.length > 0)
    .map(([rule, files]) => ({ files: files.map(escapeGlob), rules: { [rule]: "off" } }));
}

/** Baseline entries are literal paths; Next.js routes contain glob characters ([uid], (group)). */
function escapeGlob(file) {
  return file.replace(/[[\](){}*?!@+]/g, "\\$&");
}
