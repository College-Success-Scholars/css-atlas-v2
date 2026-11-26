# frontend/app/traffic

**Location:** [`frontend/app/traffic/`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/traffic)  
**Docs:** `docs/dev/frontend/app/traffic/README.md`

## Navigation

[← Root](../../../README.md) › [Frontend](../../README.md) › [app](../README.md) › traffic

---

## Purpose

Public foot-traffic **kiosk**. Anyone — signed out, scholar, team leader, or developer — records a check-in at `/traffic` without signing in. This route exists for shared devices at the front desk / study areas.

Do **not** confuse with `/dev/traffic` (authenticated analytics scratchpad).

---

## Files

| File | Description |
|------|-------------|
| `layout.tsx` | Idle-reset shell only — **no auth or role redirect** |
| `page.tsx` | Client kiosk UI; submits via `recordTrafficEntry` |
| `_components/` | Check-in form, success screen, format helpers + theme-safety tests |

---

## Public contract (do not regress)

| Layer | Rule |
|-------|------|
| Middleware | `/traffic` and `/traffic/*` stay on the public allowlist (no forced login) |
| `layout.tsx` | Never call `redirect`, `canAccessWeeklyMemo`, `requireUser`, `requireTeamLeaderOrAbove`, or `/api/auth/me` |
| Writes | `recordTrafficEntry` server action — Effect Schema-validated `uid` + `duration_min`; forced `traffic_type: "entry"`; no client `created_at` |
| Reads / analytics | Stay private: auth-gated `/api/traffic` and developer `/dev/traffic` |
| RLS | Prefer INSERT-only for anon/authenticated — [`004_traffic_public_insert.sql`](../../../supabase/004_traffic_public_insert.sql) |

Previous product mistakes gated logged-in scholars away from `/traffic`. That blocked kiosk use whenever someone was signed in on the shared device. **Do not reintroduce role or session redirects here.**

Regression coverage: `frontend/app/traffic/layout.test.tsx` fails if `layout.tsx` gains auth/role gates.

---

## Standards

- **Always public** — no login requirement; no “redirect scholars to dashboard”; no TL-only gate.
- **Idle reset only** — layout may wrap `IdleResetProvider` for kiosk UX; that is not an auth gate.
- **Theme-safe animation** — success/check-in UI uses semantic tokens; see frontend theme-safety standards and `*.test.tsx` in `_components/`.
- **Secure write path** — never insert arbitrary columns from the client; use `recordTrafficEntry`.
