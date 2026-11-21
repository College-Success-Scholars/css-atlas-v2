/**
 * @file hours-benchmark.controller.ts
 * @module backend/controllers
 *
 * Handlers for /api/hours-benchmark, bound to the contract in
 * @css-atlas/shared/contracts/hours-benchmark.
 */
import * as contract from "@css-atlas/shared/contracts/hours-benchmark";
import { implement } from "../http/endpoint.js";
import {
  getHoursBenchmarkReport,
  hoursBenchmarkPdfFilename,
  parseHoursBenchmarkHeatmapScope,
} from "../services/hours-benchmark.service.js";
import { renderHoursBenchmarkPdf } from "../services/hours-benchmark-pdf.service.js";

export const hoursBenchmarkEndpoints = [
  implement(contract.getReport, () => getHoursBenchmarkReport()),

  implement(contract.getPdf, async ({ query }) => {
    const scope = parseHoursBenchmarkHeatmapScope(query.scope);
    const report = await getHoursBenchmarkReport();
    const body = await renderHoursBenchmarkPdf(report, scope);
    return {
      contentType: "application/pdf",
      filename: hoursBenchmarkPdfFilename(report.scoredWeeks, report.printedAtSlug, scope),
      body,
    };
  }),
];
