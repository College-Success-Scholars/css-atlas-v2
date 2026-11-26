# Roles & personas

**Docs:** `docs/dev/onboarding/roles-and-personas.md`

## Navigation

[← Onboarding](README.md) › Roles & personas

**Related:** [Supabase test profiles](../supabase/README.md) · [Middleware — acting denylist](../backend/src/middleware/README.md)

---

## Purpose

Understand what each app role can see/do, and how developers safely emulate another roster identity via test personas.

---

## Role hierarchy

Stored on `profiles.app_role` (also reflected on roster views). Hierarchy (lowest → highest):

```text
null (basic user / scholar)
  └─ team_leader
       └─ developer
```

Backend gates (each endpoint declares one in its contract):

| Contract `access` | Who can call |
|-------------------|-------------|
| `"authenticated"` | Any signed-in user (any role) |
| `"team_leader"` | `team_leader` or `developer` |
| `"developer"` | `developer` only |
| `{ selfOrTeamLeader: "params.uid" }` | The scholar whose Scholar ID is at that field of the validated input, or `team_leader`/`developer`. A missing value is let through; the handler decides what it means. |

Every route declares its `access` in its contract (`shared/contracts/<domain>.ts`); `http/endpoint.ts` enforces it. No route attaches auth middleware by hand. Every non-health route answering 401 without a token is enforced by `src/tests/route-gating.test.ts`.

Scholars (`program_role` scholar, often `app_role` null) get scholar nav / dashboard surfaces and **own** form submissions (uid-scoped `/api/form-logs` + Activity Log). Team leaders get supervisory tools (Memo, week-wide form logs). Developers get `/dev` tools and persona switching.

Product vocabulary: [ubiquitous language](../../agents/ubiquitous_language.md).

---

## Day exercise (no code)

1. Sign in as your **developer** account (your real profile — full write access).
2. Open `/dev` and note available **test personas** (after SQL setup — [Supabase README](../supabase/README.md)).
3. Act as **scholar** persona — note Memo / nav differences, empty vs populated widgets.
4. Act as **team leader** persona — compare again.
5. Switch back to **My profile** before any intentional writes.

---

## Acting as a test profile — rules

- Clients send only `dev_test_profiles.id` (cookie → `X-Dev-Active-Profile`); the server resolves `roster_uid`.
- While acting, many **mutations are denylisted** (`rejectWritesWhenActing`). Read-via-POST endpoints and `/api/dev/*` stay allowed. Symptom of a blocked write: error from that middleware rather than a successful `{ data }`.
- Setup SQL order and seed placeholders: [docs/dev/supabase/README.md](../supabase/README.md).
- **Effective vs real identity:** `req.profile` / `GET /api/auth/me` → `profile` is the persona (roles, `student_id` = `roster_uid`, mentee fields). Nested `user_roster` is cleared on overlay so developer mentee data cannot leak into persona gates. `realProfile` stays the developer and is used only for developer capability checks (profile switcher, `/dev`, `requireDeveloper`).
- **RLS blindspot:** personas overlay `req.profile` only — the JWT stays the developer (`auth.uid()` / real `app_role`). Policies keyed on the JWT still see you as a developer. Acting as TL/scholar will **not** catch empty-data bugs that only real `team_leader` (or scholar) sessions hit. Smoke those with a real non-developer login; see [Auth & RLS runbook](auth-rls-runbook.md).

---

## Don’t confuse

| Term | Meaning |
|------|---------|
| `program_role` | Program identity (e.g. scholar) |
| `app_role` | Capability ladder (`null` / `team_leader` / `developer`) |
| Test persona | Curated roster row developers can assume for debugging |
| Your developer profile | Real account — use this for writes and `/api/dev` |

---

## Who to ask

Persona SQL / RLS setup questions: [Miguel](mailto:miguelventura1123@gmail.com), [Ben](mailto:bsaenz454@gmail.com), [Moosay](mailto:97802676+m0osay@users.noreply.github.com).
