/**
 * @file hours-benchmark.controller.ts
 * @module backend/controllers
 *
 * Handlers for /api/hours-benchmark, bound to the contract in
 * @css-atlas/shared/contracts/hours-benchmark.
 */
import { Effect } from "effect";
import * as contract from "@css-atlas/shared/contracts/hours-benchmark";
import { implement } from "../http/endpoint.js";
import {
  getHoursBenchmarkReport,
  hoursBenchmarkPdfFilename,
  parseHoursBenchmarkHeatmapScope,
} from "../services/hours-benchmark.service.js";
import { renderHoursBenchmarkPdf } from "../services/hours-benchmark-pdf.service.js";
import { UnavailableError } from "../utils/domain-error.js";

export const hoursBenchmarkEndpoints = [
  implement(contract.getReport, () => getHoursBenchmarkReport()),

  implement(contract.getPdf, ({ query }) =>
    Effect.gen(function* () {
      const scope = parseHoursBenchmarkHeatmapScope(query.scope);
      const report = yield* Effect.promise(() => getHoursBenchmarkReport());
      const body = yield* Effect.tryPromise({
        try: () => renderHoursBenchmarkPdf(report, scope),
        catch: () => new UnavailableError({ message: "PDF generation failed. Please try again." }),
      });
      return {
        contentType: "application/pdf",
        filename: hoursBenchmarkPdfFilename(report.scoredWeeks, report.printedAtSlug, scope),
        body,
      };
    }),
  ),
];
