# Tooling

**Docs:** `docs/dev/tooling.md` · **Why:** [ADR 004](../adr/004-one-toolchain-npm-workspaces-node.md)

Atlas uses one tool per job, run the same way on your machine, in CI and in Docker. If you are about to add a second tool for a job already listed here, read ADR 004 first.

## One tool per job

| Job | Tool | Where it is configured |
|-----|------|------------------------|
| Runtime | Node.js 26, everywhere (dev servers, crons, CI, images) | `.node-version`, `engines` in the root `package.json`, `node:26-alpine` in both Dockerfiles |
| Packages | npm 11 workspaces: `shared`, `backend`, `frontend`, one root `package-lock.json` | Root `package.json` (`workspaces`, `allowScripts`) |
| Local dev | `npm run dev`: builds `shared`, then runs the `shared` watcher, backend and frontend with `concurrently` | Root `package.json` (`predev`, `dev`) |
| Build | `tsc` for `shared` and `backend`; `next build` (standalone output) for `frontend` | Each package's `build` script |
| Type check | `tsc --noEmit` | `npm run typecheck` |
| Lint | ESLint 9 flat config per package, plus the Atlas rules in `tools/eslint-plugin-atlas` | `*/eslint.config.mjs`, `*/eslint-baseline.json` |
| Import boundaries | dependency-cruiser | `*/.dependency-cruiser.cjs`, `*/.dependency-cruiser-known-violations.json` |
| Tests | Vitest 4, one config per package | `*/vitest.config.*` (backend tests live in `backend/src/tests/`) |
| Dependency versions | syncpack: every package uses the same version of a dependency | `.syncpackrc.json` |
| Unused code and dependencies | knip | `knip.json` |
| Pre-commit | husky + lint-staged: ESLint `--fix` on staged files | `.husky/pre-commit`, `lint-staged.config.mjs` |
| CI | GitHub Actions | `.github/workflows/ci.yml`, `.github/workflows/docs.yml` |
| Images | `Dockerfile.backend` (API and both notification crons) and `Dockerfile.frontend` | Repo root |
| Deploy | Railway, infrastructure as code. The `railway` package is the SDK that `.railway/railway.ts` imports; `@railway/cli` is the CLI that evaluates it (`npx railway config plan`). Upgrade them together: an SDK release can raise the minimum CLI version | `.railway/railway.ts`, root `package.json` |
| Database | Supabase CLI (installed separately), generated types via `npm run db:types -w @css-atlas/backend` | `supabase/` |
| Agent instructions and skills | `AGENTS.md` (Claude Code reads it through `CLAUDE.md`). Skills in `.agents/skills/`, with a pointer in `.claude/skills/` for Claude Code. MCP servers in `.mcp.json` (Claude Code) and `opencode.jsonc` (OpenCode); keep the two in sync | Repo root |
| Docs site | TypeDoc for the API reference, MkDocs (Python) for the site | `typedoc.json`, `mkdocs.yml`, `requirements-docs.txt` |

## Everyday commands

All from the repo root.

| Want to | Run |
|---------|-----|
| Install everything | `npm install` |
| Start the stack | `npm run dev` |
| Run one package's script | `npm run <script> -w @css-atlas/<package>` |
| Check before a PR | `npm run guardrails`, `npm run typecheck`, `npm test`, `npm run hygiene` |
| Add a dependency | `npm install <name> -w @css-atlas/<package>` (add `-D` for dev tools) |

## Rules

- **Install from the root only.** Running `npm install` inside `backend/`, `frontend/` or `shared/` creates a second lockfile. `.gitignore` also blocks `pnpm`, `yarn` and `bun` lockfiles.
- **One version per dependency.** When you upgrade something used by more than one package, upgrade it in all of them. `npm run hygiene` (syncpack) fails otherwise.
- **Install scripts are allowlisted.** npm 11 only runs install scripts for packages listed in `allowScripts`, and each approval is pinned to a version. After upgrading `esbuild`, `sharp`, `puppeteer`, `fsevents` or `@railway/cli`, approve the new version there.
- **Internal packages are depended on as `"*"`.** For example `"@css-atlas/shared": "*"`; syncpack enforces it.
- **Never run `npm audit fix --force`.** It downgrades packages (TypeDoc, for example) to clear advisories.
- **If tests fail everywhere at once, run `npm ls <package>`.** Two copies of a package (React once) is the usual cause.
- **The pre-commit hook is the fast check, CI is the gate.** Don't skip the hook with `--no-verify`; fix what it reports.
