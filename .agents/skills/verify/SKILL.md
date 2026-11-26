---
name: verify
description: Verify CSS Atlas's Next.js web UI in a real, isolated Chrome session. Use after UI or routing changes, for a local browser smoke test, or to collect screenshots and action logs as proof. Includes a proven public landing-to-login check and feature recipes for authentication, traffic validation, mentee monitoring, and the weekly memo.
---

# Verify CSS Atlas

Run commands from the repository root, not `frontend/`. Read [the feature index](features/README.md) before selecting a journey. This skill checks the frontend in a browser; backend checks are `npm run guardrails`, `npm test` and `scripts/smoke-test.sh` (see `AGENTS.md`).

This is the canonical copy, in `.agents/skills/` so OpenCode, Codex, Cursor and other Agent Skills tools find it. Claude Code only reads `.claude/skills/`, so `.claude/skills/verify/SKILL.md` is a pointer to this file. Edit this copy, never the pointer. The helper needs macOS (`lsof`) and Chrome.

## Launch

The default is a public, unauthenticated frontend check. It needs installed frontend dependencies, Python 3, Node, macOS `lsof`, an installed Chrome, and the existing `frontend/.env.local` configuration. Do not print, create, or edit secret files. Middleware requires `NEXT_PUBLIC_SUPABASE_URL` and a public key even for public pages. The helper does not seed, migrate, log in, or require application records.

If shared build output is absent, build it once:

```sh
snip npm run build -w @css-atlas/shared
```

Install the driver locally only with permission. This does not change application manifests or lockfiles:

```sh
snip npm install --prefix .audit/verify-tools --no-audit --no-fund --package-lock=false --ignore-scripts agent-browser@0.43.0
snip .audit/verify-tools/node_modules/.bin/agent-browser skills get core
```

Run the complete public proof with a new, unused evidence directory:

```sh
snip python3 .agents/skills/verify/scripts/control.py smoke --run-dir .audit/verify-runs/landing-check-01
```

Increment the directory suffix on subsequent runs. The helper launches the repository's Next.js 16.2.4 Turbopack dev command on `127.0.0.1:4310`. It overrides both backend URL variables to the initially unused local port `4311`, so a forgotten remote backend URL cannot service this public check. It uses existing public Supabase configuration, not a disposable database. Public coverage is not proof that Supabase or the backend works.

Readiness requires an owned listener, HTTP 200, and the rendered landing heading. The helper then clicks the actual `Sign in` link, requires `/auth/login` and the form controls, captures evidence, and stops its processes. Do not treat the Next.js `Ready` line as sufficient.

For a manual public journey, keep the owned instance running:

```sh
snip python3 .agents/skills/verify/scripts/control.py serve --run-dir .audit/verify-runs/manual-check-01
```

Run this in a foreground terminal or a managed background shell whose PID you retain. Stop it with Ctrl+C or send SIGTERM to that exact helper PID. Its handler stops its Next.js process group. Do not kill by name.

Two Next dev instances cannot share this checkout's `.next/dev` output. The helper refuses an existing dev lock or occupied ports. Use a separate checkout and coordinated ports for concurrent runs, or wait. Never delete an unfamiliar lock.

## Doctor

While a `serve` run is active, run this read-only check first whenever anything looks wrong:

```sh
snip python3 .agents/skills/verify/scripts/control.py doctor --run-dir .audit/verify-runs/manual-check-01
```

It checks the recorded PID, listener process group, and actual landing response. Inspect `server.log` for startup/configuration errors. Never drive an unrelated process merely because its port answers. Doctor does not validate credentials, backend data, or fixture coverage.

## Drive

The automated `smoke` command implements [landing-to-login](features/landing.md). For other public journeys use the owned `serve` instance and a fresh named browser. The matching session and namespace below are derived from the run directory's basename:

```sh
snip .audit/verify-tools/node_modules/.bin/agent-browser --session atlas-manual-check-01 --namespace atlas-manual-check-01 --no-auto-connect --allowed-domains 127.0.0.1,localhost --executable-path "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" open http://127.0.0.1:4310/
```

Use the same session and namespace on every command. Do not use the default session, an existing personal profile, `--restore`, `--cdp`, or automatic connection. Remove inherited `AGENT_BROWSER_*` connection/state settings before a manual launch. The smoke helper does this itself. `--allowed-domains` limits browser traffic; it does not constrain server-side requests.

In feature files, `AB` means the full driver invocation above, omitting only `open` and its URL. It is notation, not a command installed on PATH. Append each shown command to that invocation. After a page change, take a fresh snapshot. Use accessible names or fresh refs, never hard-code generated React IDs or old snapshot refs.

The remaining mapped journeys are source-grounded recipes, not claims that they passed. Authentication, mentees, and memo require an approved full-stack environment and account. The public launcher intentionally does not provide one. Stop and report that prerequisite rather than adding fixtures, bypassing auth, or weakening assertions. `npm run dev` (repo root) is the documented full-stack entry point, but requires separate approval and review before execution. It uses ports 3000/3001, existing database configuration, and writes build output and a symlink. Its startup banner is not a readiness check.

## Evidence

Evidence survives in the chosen `.audit/verify-runs/` directory:

- `actions.log` contains browser commands, stdout/stderr, and exit codes, including browser close.
- `landing.aria.txt`, `login.aria.txt`, `landing.png`, and `login.png` show before and after the actual link click.
- `doctor.txt`, `server.log`, `browser-errors.txt`, `result.txt`, and `cleanup.txt` record readiness, runtime observations, verdict, and teardown.
- `next.pid` and `port` identify this run. They are historical after cleanup, not proof of a live process.

Capture both the action and resulting state. A final screenshot alone is not proof. Read `browser-errors.txt` and server errors before reporting success. Record each exercised feature ID and entry point. Report unrun entries as unverified, and missing fixture prerequisites as blocked, not passing empty alternatives.

Exercise real UI paths without internal state setters, mocked auth, or test-only endpoints. For approved mutations, verify persisted state from a second user-facing view and, where authorized, a read-only database/API observation. Public landing navigation is not a mutation test. Valid traffic submissions, signup, password reset, profile saves, external forms, and notification jobs are outside the default run. Never assume a persona or a command called dry-run prevents writes. Observe requests and side effects if such a mode is explicitly authorized.

Authenticated traces, screenshots, and logs can contain student information or tokens. Keep them local, redact before sharing, and never capture password values or browser storage. The public proof has no credentials. Do not commit `.audit/verify-tools/node_modules` or raw authenticated evidence.

## Cleanup

`smoke` closes its exact named browser and terminates its owned server group in `finally`, including on failed browser steps. It retains evidence. If browser close fails, inspect `browser-cleanup-error.txt` and retry close for that exact session only. For manual runs, close the named browser before stopping the helper:

```sh
snip .audit/verify-tools/node_modules/.bin/agent-browser --session atlas-manual-check-01 --namespace atlas-manual-check-01 close
```

Never use `close --all`, `pkill`, or broad deletions. After teardown, verify the recorded server is gone, the selected port is free, and evidence files still exist. Leave preexisting processes, credentials, database records, and evidence untouched. Next.js cache/build output may remain; do not delete it as part of cleanup.

## Helpers

The executable [scripts/control.py](scripts/control.py) owns launch, readiness, public smoke, and server cleanup. `serve` supports `--port` to select a free frontend port and reserves the following port for the absent backend. `smoke` supports `--chrome` for an alternate installed Chrome executable. `doctor` needs only `--run-dir`.

The tested platform is macOS with existing dependencies and environment configuration. Clean-machine dependency installation, a fresh database, authenticated workflows, and other operating systems remain unverified. There is no reproducible local seeded baseline: `supabase/config.toml` refers to a `seed.sql` absent from this checkout. Do not invent seed rows or run migrations to satisfy a journey.

Keep the feature map current through `/maintain-verification-skill`, registered in OpenCode as `pstack-maintain-verification-skill`.
