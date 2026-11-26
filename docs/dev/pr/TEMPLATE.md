# PR title

<!-- Short, imperative, what lands if merged. Example: `Add developer test-profile acting and CI` -->

## Summary

<!-- 1–3 sentences: what this PR does and why. Then 2–4 bold-lead bullets for the headline work. -->

- **Area A** — one-line outcome a reviewer can scan
- **Area B** — one-line outcome
- **Area C** — one-line outcome

Fixes #<!-- issue -->

## Changelog

### Commits (`<!-- base -->` → `<!-- head -->`)

<!-- `git log <base>..HEAD --oneline` -->

| SHA | Message |
|-----|---------|
| `` |  |

<!-- Optional: `(~N insertions / ~M deletions across ~P files)` and `Base: … · Head: …` -->

---

### <!-- Feature / area name -->

**What it is:** <!-- one sentence for someone new to the change -->

**Backend**
- <!-- files, middleware, routes, services, denylists, migrations -->

**Frontend**
- <!-- routes, components, server actions, notable UX -->

**Shared / infra**
- <!-- shared/, CI, scripts, Supabase SQL, env -->

**Docs / agent logs**
- <!-- handbook paths + `docs/agents/logs/…` for deep context -->

<!-- Repeat `###` sections per theme. Prefer themes over a flat file dump. Drop empty Backend/Frontend/Shared bullets. -->

---

### Docs / knowledge updates worth reading first

| Area | Start here |
|------|------------|
|  |  |

---

### Notable removals / behavior changes

| Change | Impact |
|--------|--------|
|  |  |

---

### Suggested follow-ups (not in this PR)

- 

## Test plan

<!-- Concrete, reproducible checks. Include the package scripts you actually ran. -->

- [ ] <!-- Manual / product path -->
- [ ] `npm test -w @css-atlas/frontend` <!-- and/or `npm run build -w @css-atlas/frontend` if FE touched -->
- [ ] `npm test -w @css-atlas/backend` <!-- and/or `npm run build -w @css-atlas/backend` if BE touched -->
- [ ] <!-- `docker compose build` / CI green / docs:coverage if relevant -->
