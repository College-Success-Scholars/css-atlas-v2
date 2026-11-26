# models/

**Location:** [`backend/src/models/`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/backend/src/models)  
**Docs:** `docs/dev/backend/src/models/README.md`

## Navigation

[← Root](../../../README.md) › [Backend](../../README.md) › [src](../README.md) › models

---

## Purpose

TypeScript type definitions and constants that describe the shape of domain / API data. Models have **zero runtime logic**. Prefer API-oriented shapes (what controllers return) over copying every Postgres column. Raw table types come from generated [`Database`](../supabase/README.md) when you need them.

---

## Modules

One `*.model.ts` per domain (user, session-log, attendance-week, weekly-minutes, form-log, traffic, time, daily-scholar-activity, mentee, tutor-report-log). Source: [`backend/src/models/`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/backend/src/models). Symbol docs: [API Reference](../../../../reference/README.md).

---

## Standards

- **Types only** — no functions, no class methods, no runtime logic.
- **No Supabase imports** — models must not import from `@supabase/supabase-js`.
- **Mirror column names when the type is a table row** — otherwise name fields for the API contract.
- **Do not treat models as the schema source of truth** — regenerate [`database.types.ts`](../supabase/README.md) after migrations; fix code to match Postgres, not the reverse.
- **Constants here if type-adjacent** — `APP_ROLE_ORDER` is re-exported from `shared/auth.ts` (canonical source); `user.model.ts` keeps the re-export for backward compatibility.
- **Naming** — row types end in `Row` (e.g., `ProfilesRow`). Computed/aggregated shapes use descriptive names (e.g., `MemoUserRow`, `TeamLeaderRow`).
- **One model file per domain** — align with the corresponding service and controller files.

<!-- AUTO-API-REFERENCE:START -->

## API Reference

Generated from TypeScript signatures. Module indexes below; full catalog: [API Reference hub](../../../../reference/README.md).

| Module | Reference |
|--------|----------|
| `attendance-week.model` | [API](../../../../reference/api/backend/src/models/attendance-week.model/README.md) |
| `daily-scholar-activity.model` | [API](../../../../reference/api/backend/src/models/daily-scholar-activity.model/README.md) |
| `form-log.model` | [API](../../../../reference/api/backend/src/models/form-log.model/README.md) |
| `meeting-preference.model` | [API](../../../../reference/api/backend/src/models/meeting-preference.model/README.md) |
| `mentee-mcf-prefill.model` | [API](../../../../reference/api/backend/src/models/mentee-mcf-prefill.model/README.md) |
| `mentee-review.model` | [API](../../../../reference/api/backend/src/models/mentee-review.model/README.md) |
| `mentee.model` | [API](../../../../reference/api/backend/src/models/mentee.model/README.md) |
| `session-log.model` | [API](../../../../reference/api/backend/src/models/session-log.model/README.md) |
| `time.model` | [API](../../../../reference/api/backend/src/models/time.model/README.md) |
| `traffic.model` | [API](../../../../reference/api/backend/src/models/traffic.model/README.md) |
| `tutor-report-log.model` | [API](../../../../reference/api/backend/src/models/tutor-report-log.model/README.md) |
| `user.model` | [API](../../../../reference/api/backend/src/models/user.model/README.md) |
| `weekly-minutes.model` | [API](../../../../reference/api/backend/src/models/weekly-minutes.model/README.md) |

<!-- AUTO-API-REFERENCE:END -->
