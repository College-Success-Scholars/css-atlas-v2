## Agent skills

### Issue tracker

Issues are tracked in this repository's GitHub Issues and managed via `gh` (`gh auth login` required). See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the canonical default labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Architectural alerts

Architectural alerts are **GitHub Issues** labeled `architecture-alert` — not files under `docs/agents/alerts/`. Discover open work with:

```bash
gh issue list --label architecture-alert --state open
```

Open via the **Architecture alert** issue template or `./scripts/alert.sh`. Resolve with `./scripts/resolve-alert.sh --issue <N>`.

To check whether open alerts still match the tree, use the project skill `.cursor/skills/scan-architecture-alerts/` (“scan alerts”).

### Domain docs

Domain docs use a single-context layout (root `CONTEXT.md` + `docs/adr/` when present). See `docs/agents/domain.md`.

## Knowledge base

The codebase has a specfic structure to follow and to generally maintain. See `docs/agents/codebase-notes.md`

## Guardrails

Patterns that need judgement are banned outright and enforced by lint and a dependency checker. Read `docs/dev/guardrails.md` before writing code. After every change run, in the app you touched:

```bash
npm run guardrails -w @css-atlas/backend
npm run guardrails -w @css-atlas/frontend
```

- Never add a file to `eslint-baseline.json` or `.dependency-cruiser-known-violations.json`, and never add an `eslint-disable` comment, to get green. Those lists only shrink.
- Do not copy a pattern from a grandfathered file. If a file is in a baseline, it is an example of what not to write.
- When you fix a grandfathered file, delete its baseline entry in the same change (`npm run lint:baseline` tells you which).

## Adding or changing an API endpoint

Endpoints are contract-backed. Describe the endpoint once in `shared/contracts/<domain>.ts`, bind a handler with `implement()` in the controller, and call it from the frontend with `callEndpoint()`. Reference implementation: `shared/contracts/attendance.ts` + `backend/src/controllers/attendance-week.controller.ts`. New services return `Effect.Effect<Output, DomainError, CurrentCaller>` (reference: `upsertExcuse` in `backend/src/services/attendance-week.service.ts`). Full rules: `docs/dev/backend/src/controllers/README.md`.
