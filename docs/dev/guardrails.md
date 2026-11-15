# Guardrails

**Location:** `tools/`, `backend/eslint.config.mjs`, `frontend/eslint.config.mjs`, `*/.dependency-cruiser.cjs`

The codebase is the largest input to every agent and every new developer. Whatever pattern exists gets copied. So where a pattern needs judgement to use well, we ban it outright and enforce the ban mechanically.

```bash
npm --prefix backend run guardrails    # lint + baseline check + import direction
npm --prefix frontend run guardrails
```

CI runs both. A red guardrail is fixed by changing the code, never by widening a baseline.

## Banned patterns (ESLint, `tools/eslint-plugin-atlas`)

| Rule | Applies to | Do this instead |
| --- | --- | --- |
| `atlas/no-use-effect` | frontend, except `hooks/` | Fetch in a Server Component or server action, derive state during render, or use a named hook from `frontend/hooks/` |
| `atlas/no-clock-read` (`new Date()`, `Date.now()`) | backend `services/`, `models/`, `utils/`, `domains/`; frontend except `hooks/` | Accept `asOf: Date` as a parameter. Controllers and cron entrypoints read the clock and pass it down |
| `atlas/no-process-env` | both apps | Read configuration once in the app's env module and pass it in |
| `atlas/no-express-import` | backend `controllers/` | Bind a handler to a contract with `implement()`; see [controllers](backend/src/controllers/README.md) |
| `atlas/no-schema-library` (`zod`) | backend | Schemas live in `shared/contracts/`; validate with `validate()` from `@css-atlas/shared/contract` |
| relative imports of `shared/` | both apps | Import by package name: `@css-atlas/shared/<module>` |
| `atlas/no-try-catch` | backend `controllers/` | Let errors reach the global error handler; throw a typed error for a specific status |
| `atlas/no-double-cast` (`as unknown as`) | both apps | Fix the source type (regenerate `database.types.ts`) or parse the value |
| `atlas/no-supabase-query` (`.from("table")`) | frontend | Call an Express endpoint through `lib/server/data.ts` |
| `atlas/no-raw-fetch` | frontend, except the two `api-client.ts` modules | Use the typed wrappers |
| `atlas/no-dynamic-import` | backend | Import at the top of the file |
| `atlas/no-enum` | both apps | String-literal union |
| `no-explicit-any`, `ban-ts-comment` | both apps | Type it |
| imports from `backend/src` | frontend | Share through `shared/` |

Tests are exempt from the clock, env, cast and fetch rules.

## Import direction (dependency-cruiser)

The directory a file lives in decides what it may import.

```
backend:   routes → controllers → services / domains → models · supabase · utils
           (http/ is the request lifecycle; nothing below controllers imports it)
frontend:  app/<route> → components → lib · hooks → shared
```

| Rule | Meaning |
| --- | --- |
| `routes-only-wire-controllers` | Routes never import services, domains, models or Supabase |
| `controllers-never-query-supabase` | Only services and domains import `supabase/client` |
| `no-upward-imports`, `models-are-leaves` | Nothing below the HTTP edge imports it |
| `no-express-below-controllers` | Express types stop at controllers and middleware |
| `services-never-import-domains`, `domains-are-isolated` | A domain may use shared services; nothing reaches into a domain, and domains do not import each other |
| `nothing-imports-app`, `lib-is-below-components` | `components/`, `lib/`, `hooks/` never import upward |
| `dashboard-routes-are-isolated` | One dashboard route never imports another's `_lib` or `_components`; shared code moves down |
| `dev-pages-are-not-a-library` | Product routes never import `app/dev` |
| `no-circular`, `no-test-imports-in-source` | Both apps |

## Baselines

Files that broke a rule before it existed are grandfathered:

- `backend/eslint-baseline.json`, `frontend/eslint-baseline.json` — rule → files where that rule is switched off.
- `*/.dependency-cruiser-known-violations.json` — individual import edges.

The rules:

1. **Baselines only shrink.** Never add an entry, and never add an `eslint-disable` comment, to make a change pass.
2. **A grandfathered file is not an example.** Do not copy its pattern into a new file.
3. **Fixing a file removes its entry.** `npm run lint:baseline` fails if a listed file no longer violates its rule, so the entry is deleted in the same change and the file is protected from then on.

Regenerate after removing violations (review the diff — it must only delete lines):

```bash
cd backend && node ../tools/lint-baseline.mjs --write && npm run deps:baseline
```

## Adding a rule

Add it when a review comment would otherwise have to say "it depends". Write the ban in `tools/eslint-plugin-atlas/index.mjs` with a message that names the replacement, scope it in the app's `eslint.config.mjs`, run `--write` to grandfather today's violations, and add a row to the table above.
