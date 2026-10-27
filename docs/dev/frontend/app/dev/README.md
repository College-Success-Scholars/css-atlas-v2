# app/dev

**Location:** [`frontend/app/dev/`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/dev)  
**Docs:** `docs/dev/frontend/app/dev/README.md`

## Navigation

[← Root](../../../README.md) › [Frontend](../../README.md) › [app](../README.md) › dev

---

## Purpose

Developer-only scratchpad for testing backend API integrations and inspecting raw data. These pages were built to validate Express backend endpoints during the migration away from Next.js API routes. **They are not kept in sync with production UI patterns** and should not be treated as a component library or source of reusable widgets.

For production features, build in `app/dashboard/` and shared components in `components/`.

---

## Files

| File | URL | Description |
|------|-----|-------------|
| `layout.tsx` | `/dev/*` | Dev section layout — enforces `requireDeveloper` guard |
| `page.tsx` | `/dev` | Dev tools home / index |
| `form-logs/page.tsx` | `/dev/form-logs` | Browse raw MCF/WHAF/WPL form submissions |
| `freshman-grades/page.tsx` | `/dev/freshman-grades` | Temporary FD/SS/WAHF completion for enrolled freshmen and sophomores through the previous campus week (current week 6 scores weeks 2–5; week 1 is not scored) (`GET /api/dev/freshman-grades`). Freshmen and sophomores are separate tables with the same columns. Shows roster uid and mentor. Selecting a scholar opens the weekly minutes. Each table's Download CSV offers Overall (the on-screen averages) or In-depth (one row per scholar-week, with that week's capped FD/SS/WAHF percent plus recorded, excused, total, and expected minutes). The first cell is the week numbers covered, such as 2-5. Repeated name and UID cells are left blank. A mentor cell is blank only on a later week for the same scholar. Grade cells are always written. Sophomore files are named `sophomore-grades-…`. |
| `profiles/page.tsx` | `/dev/profiles` | Roster list with enrollment status and an active-members filter |
| `profiles/[uid]/page.tsx` | `/dev/profiles/:uid` | Edit roster (including enrollment) plus attendance, logs, and form submissions |
| `profiles/roster-edit-form.tsx` | — | Client form that PATCHes `/api/dev/roster/:uid` (`app_role` is read-only) |
| `session-logs/page.tsx` | `/dev/session-logs` | Raw session check-in/out logs with heat map |
| `session-records/page.tsx` | `/dev/session-records` | Retired notice — use `/dashboard/teams/*` and `/api/attendance` |
| `traffic/page.tsx` | `/dev/traffic` | Traffic count analytics |

---

## Standards

- **`requireDeveloper()` in `layout.tsx`** — guards the entire `/dev/*` subtree.
- **Scratchpad quality bar** — large client `page.tsx` files are acceptable here; do not copy this pattern to `dashboard/`.
- **Do not import from `app/dev/` in production routes** — if a chart or table is needed elsewhere, move it to `components/charts/` or `components/data-display/`.
- **Calls `/api/dev/*` or standard `/api/*`** — may return more raw/unfiltered data than production pages.
- **No public access** — never remove the developer guard.
