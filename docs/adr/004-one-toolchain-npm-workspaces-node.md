# ADR 004: One toolchain — npm workspaces on Node 26

**Status:** Accepted
**Date:** 2026-11-26

## Decision

- **npm workspaces** (`shared`, `backend`, `frontend`) with **one root `package-lock.json`**. Not Bun, pnpm or Yarn.
- **Node.js 26 everywhere**: local dev, CI, Docker images and the two notification crons. No Bun runtime.
- **Two Docker images.** `Dockerfile.backend` runs the API and both crons (Railway sets a different start command per cron). `Dockerfile.frontend` uses Next's standalone output.
- **`concurrently` for local dev** (`npm run dev`), replacing `scripts/dev.sh` and `scripts/dev.ps1`.
- **Hygiene in CI:** syncpack for version consistency, knip for unused files and dependencies.
- **husky + lint-staged** for a fast pre-commit lint. CI stays the real gate.
- **No Turborepo** for now.

The full table of tools and where each is configured is in [Tooling](../dev/tooling.md).

## Why

Atlas is maintained by rotating undergraduates and by coding agents, often without a handoff. Every extra tool is one more thing the next person has to learn, install and keep working.

Before this change the repo had four lockfiles, Bun in some places and npm in others, four Dockerfiles, and shell scripts that worked around the setup instead of fixing it (`dev.sh` symlinked `next` into the root so Turbopack could find it). Versions drifted between packages; two copies of React once broke 114 tests at the same time.

- **npm over Bun or pnpm:** Node and npm are already in CI and every image, and every new developer knows them. Bun's faster installs save seconds on a three-package repo, and cost a second binary everywhere plus install-script and Alpine binary differences. syncpack covers what Bun or pnpm catalogs would add.
- **Node for the crons:** their code already lives in `backend/src`, so `tsc` compiles it with the API and one image runs all three. That is what let four Dockerfiles become two.
- **No Turborepo:** with three packages, root scripts are enough. Revisit if CI time becomes a problem.
- **Pre-commit hook:** agents and people forget to run the guardrails before committing; a hook runs on every commit and puts lint errors in front of whoever committed. It stays fast (staged files only) so nobody is tempted to skip it.

## Consequences

- Install and run everything from the repo root (`npm install`, `npm run dev`, `npm run <script> -w @css-atlas/<package>`).
- Branch protection still requires the original CI job names (`backend-test`, `frontend-test`); `repo-hygiene` is a new job.
- npm 11's `allowScripts` approvals are pinned to versions and need re-approving after upgrading `esbuild`, `sharp`, `puppeteer` or `fsevents`.
- `prepare` is `husky || true` because the backend image's `npm ci --omit=dev` does not install husky.
- The backend image includes Chromium (for the memo PDF export), so the crons carry it too. That costs disk space, not runtime.

## Rollback

Each part is a separate commit on `chore/fix-tooling`; revert the relevant commit. Moving back to per-package lockfiles would also need the old Dockerfiles and CI steps restored.
