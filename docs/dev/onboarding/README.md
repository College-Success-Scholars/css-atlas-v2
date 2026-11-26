# Onboarding

**Docs:** `docs/dev/onboarding/README.md`

## Navigation

[← Root](../README.md) › Onboarding

| Guide | When |
|-------|------|
| [Day 0 setup](day-0-setup.md) | First clone — get the stack running (`npm install && npm run dev`) |
| [Branching & reviews](branching-and-reviews.md) | `develop` / `main`, teams, CODEOWNERS, rulesets |
| [Golden path (first PR)](golden-path-first-pr.md) | First real change end-to-end |
| [Roles & personas](roles-and-personas.md) | Understanding scholar / team leader / developer |
| [Campus weeks](campus-weeks.md) | Dates, `weekNum`, Memo alignment |
| [Auth & RLS runbook](auth-rls-runbook.md) | Empty data, 401s, acting-as blocks |
| [Ask / don’t touch](ask-and-dont-touch.md) | Who to contact; high-risk areas |
| [PR template](../pr/TEMPLATE.md) | Required shape for every pull request |
| [Issue tracker](../../agents/issue-tracker.md) | File tickets (Bug / Feature / Chore / Architecture alert); triage labels |
| [Project board](../../agents/github-project-board.md) | Optional Kanban columns ↔ triage labels |

---

## Purpose

Guided path for new developers. The [handbook home](../README.md) and area READMEs are the **reference** layer — open those when you know what you’re looking for. This folder is the **ordered start**: get the app up, learn the seams that bite, ship a small PR with the real template.

Do **not** duplicate architecture encyclopedias here. Link out to existing docs instead.

---

## First week (suggested)

| Day | Goal |
|-----|------|
| 0–1 | [Day 0 setup](day-0-setup.md) — `npm install && npm run dev`, sign in, one authenticated `/api/*` call |
| 2 | Trace one request using [codebase notes](../../agents/codebase-notes.md) (no code changes yet) |
| 3 | [Roles & personas](roles-and-personas.md) — switch test personas, compare UI |
| 4 | [Campus weeks](campus-weeks.md) — verify a Memo week against `shared/time-config.ts` |
| 5 | [Branching & reviews](branching-and-reviews.md) + [Golden path](golden-path-first-pr.md) — tiny change + tests + PR into `develop` using the [PR template](../pr/TEMPLATE.md) |

---

## Who to ask

People who have written commits in this repo (as of this writing):

| Name | Contact |
|------|---------|
| Miguel Ventura | [miguelventura1123@gmail.com](mailto:miguelventura1123@gmail.com) |
| Benjamin Saenz | [bsaenz454@gmail.com](mailto:bsaenz454@gmail.com) |
| Moosay Hailewold |  |

Full don’t-touch list and when to ping: [Ask / don’t touch](ask-and-dont-touch.md).

---

## Tickets

Product/behavior changes need a GitHub Issue first (use the **Bug**, **Feature**, **Chore**, or **Architecture alert** templates). Conventions and architectural-alert CLI: [`docs/agents/issue-tracker.md`](../../agents/issue-tracker.md). Requires `gh` for scripted alerts (`gh auth login`).

## Pull requests

- **Base branch:** `develop` for normal work. Juniors never target `main` — see [Branching & reviews](branching-and-reviews.md).
- **Review:** CODEOWNERS requires a **Senior Developer** approval before the PR can merge into `develop`.
- **Description:** follow **[`docs/dev/pr/TEMPLATE.md`](../pr/TEMPLATE.md)** (Summary, Changelog, Test plan with the package scripts you actually ran). There is no auto-injected `.github` PR template yet — copy from that file when opening the PR. Link with `Fixes #<n>`.

---

## Related reference

- [Handbook home](../README.md) — architecture, env vars, standards
- [Ubiquitous language](../../agents/ubiquitous_language.md) — domain glossary
- [REST API](../backend/api.md) — HTTP contracts
- [Supabase test profiles](../supabase/README.md) — SQL setup for personas
