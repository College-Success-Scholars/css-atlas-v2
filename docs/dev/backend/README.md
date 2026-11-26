# Backend

**Location:** [`backend/`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/backend)  
**Docs:** `docs/dev/backend/README.md`

## Navigation

[← Root](../README.md) › Backend

Children: [src/](src/README.md)

---

## Purpose

The Express + TypeScript REST API server. It validates user JWTs from Supabase, enforces role-based access, and serves domain data to the frontend. All database access (Supabase) lives here — the frontend never queries Supabase directly for domain data.

---

## Files


| File               | Source Link                                 | Description                                                           |
| ------------------ | ------------------------------------------- | --------------------------------------------------------------------- |
| `package.json`     | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/backend/package.json)     | NPM workspace config, scripts, and dependencies                       |
| `tsconfig.json`    | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/backend/tsconfig.json)    | TypeScript compiler config (ESM, Node 26 runtime)                     |
| `vitest.config.ts` | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/backend/vitest.config.ts) | Vitest test runner configuration                                      |
| `railway.toml`     | [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/backend/railway.toml)     | Railway deployment configuration — see [Deployment](../deployment/README.md) |
| `API.md`           | [REST API (Pages)](api.md) · [source](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/backend/API.md) | Comprehensive REST API reference (all endpoints, auth levels, params) |


---

## Subdirectories


| Directory | Docs                           | Description                |
| --------- | ------------------------------ | -------------------------- |
| `src/`    | [src/README.md](src/README.md) | All TypeScript source code |


---

## Scripts

```bash
npm run dev        # tsx watch (hot reload, uses dotenv)
npm run build      # tsc (outputs to dist/)
npm run typecheck  # tsc --noEmit
npm run start      # node dist/server.js (production)
npm run test       # vitest run
npm run test:watch # vitest
```

---

## Standards

- **Entry point is `src/server.ts`** — do not run `app.ts` directly; server.ts handles env validation and process lifecycle.
- **Build output goes to `dist/`** — never commit the `dist/` directory.
- `**.js` extensions on all local imports** — required for Node ESM even though source is `.ts`.
- **No `.env` files committed** — use Railway environment variable injection in production.
- **API reference must stay updated** — when adding or changing endpoints, update `API.md`.
- **All routes must be registered in `src/app.ts`** — do not create loose route files outside `src/routes/`.

