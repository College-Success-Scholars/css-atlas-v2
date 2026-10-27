# app/dashboard/hours-benchmark

**Location:** [`frontend/app/dashboard/hours-benchmark/`](https://github.com/College-Success-Scholars/css-atlas-v2/blob/develop/frontend/app/dashboard/hours-benchmark)  
**Docs:** `docs/dev/frontend/app/dashboard/hours-benchmark/README.md`

## Navigation

[← Root](../../../../README.md) › [Frontend](../../../README.md) › [app](../../README.md) › [dashboard](../README.md) › hours-benchmark

---

## Purpose

Multi-week **CSS Hours Benchmark Report** for developers only. It surfaces scholars who fell to 50% or lower (or missed the 80% benchmark) on front desk or study session hours from campus week 2 through the previous week.

Completion uses the same compute-on-read math as Weekly Memo: logged minutes plus `scholar_week_excuses`, rounded percent.

---

## Surfaces

| Surface | Path |
|---------|------|
| Dashboard page | `/dashboard/hours-benchmark` |
| JSON API | `GET /api/hours-benchmark` |
| PDF | Same-origin `GET /api/hours-benchmark/pdf` → Express `GET /api/hours-benchmark/pdf` |

Export PDF must not call Express from the browser; the Next route proxies with the server `BACKEND_URL` and cookie JWT.

---

## Files

| File | Description |
|------|-------------|
| `page.tsx` | Server page; fetches `getHoursBenchmarkReport()` |
| `layout.tsx` | Redirects unless the real profile is a developer (`isDeveloperProfile`) |
| `types.ts` | Shared report types + threshold constants |
| `_components/hours-benchmark-report-view.tsx` | KPIs, heatmap, TL rollup, detail list |
| `_components/hours-benchmark-export-button.tsx` | Client PDF download |

Backend: `hours-benchmark.service.ts`, `hours-benchmark-pdf.service.ts`, `hours-benchmark.controller.ts`, `hours-benchmark.routes.ts`.

---

## Standards

- Developer only (`isDeveloperProfile` on the real profile / `requireDeveloper`).
- Do not treat `/dev` scratchpad pages as the pattern for this feature.
- Week 1 and the current campus week are never scored.
