# app/dashboard

**Location:** [`frontend/app/dashboard/`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/dashboard)  
**Docs:** `docs/dev/frontend/app/dashboard/README.md`

## Navigation

[← Root](../../../README.md) › [Frontend](../../README.md) › [app](../README.md) › dashboard

Children: [memo/](memo/README.md)

---

## Purpose

The main authenticated application. All routes here require a valid Supabase session. The dashboard layout provides the sidebar navigation shell; each child page renders specific domain views (memo, personal activity, mentee monitoring, etc.).

---

## Files

| File | Source Link | URL | Description |
|------|-------------|-----|-------------|
| `layout.tsx` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/dashboard/layout.tsx) | `/dashboard/*` | Dashboard shell with sidebar — wraps all child pages |
| `page.tsx` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/dashboard/page.tsx) | `/dashboard` | Main dashboard — scholar, team-leader/developer, or default home via `resolveUserRole()` |
| `directory/page.tsx` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/dashboard/directory/page.tsx) | `/dashboard/directory` | Scholar directory |
| `events/page.tsx` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/dashboard/events/page.tsx) | `/dashboard/events` | Program events |
| `internship-board/page.tsx` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/dashboard/internship-board/page.tsx) | `/dashboard/internship-board` | Internship opportunities board |
| `memo/page.tsx` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/dashboard/memo/page.tsx) | `/dashboard/memo` | Weekly memo view (complex, see memo/ docs) |
| `memo-legacy/page.tsx` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/dashboard/memo-legacy/page.tsx) | `/dashboard/memo-legacy` | Legacy memo view — kept for reference |
| `personal/page.tsx` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/dashboard/personal/page.tsx) | `/dashboard/personal` | Own weekly WAHF/WPL/MCF status; MCF is one form per mentee (some-but-not-all is incomplete) |
| `mentee/page.tsx` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/dashboard/mentee/page.tsx) | `/dashboard/mentee` | Mentee monitoring (team leaders only) |
| `room/page.tsx` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/dashboard/room/page.tsx) | `/dashboard/room` | Room/session in-progress view |
| `settings/page.tsx` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/dashboard/settings/page.tsx) | `/dashboard/settings` | User account settings |

---

## Subdirectories

| Directory | Docs | Description |
|-----------|------|-------------|
| `memo/` | [memo/README.md](memo/README.md) | Memo page components, utilities, and assembler logic |

---

## Standards

- **All pages require auth** — call `requireUser()` or a role-specific guard from `lib/supabase/server.ts` at the top of every page.
- **Layout owns the sidebar** — `layout.tsx` renders the `AppSidebar` and `SidebarProvider`. Pages must not re-render the sidebar.
- **Data fetching in the page file** — fetch from `lib/server/data.ts` or `lib/server/api-client.ts` in the server component, pass results as props to client components.
- **Role-based rendering** — use `resolveUserRole()` (`profile.app_role` / `program_role`) to pick scholar, team-leader, developer, or default. There is no admin or exec dashboard.
