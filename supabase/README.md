# Supabase (CLI)

Versioned SQL for the cloud project lives here.

| Path | Purpose |
|------|---------|
| `config.toml` | Local CLI config (`project_id` only; secrets stay in env / Dashboard) |
| `migrations/` | Public schema baseline + future DDL / RLS / RPC changes |
| `.temp/` | Linked project metadata (gitignored) |

**No Edge Functions.** This stack does not use `supabase/functions/` or invoke Supabase Edge Functions. Domain access is Express services → Postgres (tables / RPCs). See [`docs/dev/supabase/README.md`](../docs/dev/supabase/README.md#access-pattern).

## Status

- [`migrations/20260715051600_baseline.sql`](migrations/20260715051600_baseline.sql) — schema-only dump of `public` (Phase 1).
- [`migrations/20260903033000_form_log_rls_own_or_leaders.sql`](migrations/20260903033000_form_log_rls_own_or_leaders.sql) — MCF/WPL/WAHF SELECT: own roster uid or `team_leader`/`developer` (replaces `USING (true)` / stale WAHF role names).
- Linked remote migration history repaired (Step 2): orphans reverted; baseline marked **applied**. Local and remote agree on `20260715051600`.
- Backend typed client + generated types: [`backend/src/supabase/`](../backend/src/supabase/) (Step 3). Regen: `npm run db:types -w @css-atlas/backend`, then run backend tests (includes model↔`Database` align checks).
- Do **not** `db push` the baseline onto prod — it is already applied as history only. Use new migration files for future DDL.

## Day-to-day

```bash
supabase link --project-ref <ref>   # once per machine
supabase migration new <name>
# edit migrations/…
supabase db push                    # staging first, then prod
supabase migration list --linked    # confirm local/remote match
npm run db:types -w @css-atlas/backend
```

See also: [`docs/dev/supabase/README.md`](../docs/dev/supabase/README.md) (access pattern, Google Form intake tables, schema↔app types, test-profile runbooks).
