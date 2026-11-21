/**
 * @file memo.controller.ts
 * @module backend/controllers
 *
 * Handlers for /api/memo, bound to @css-atlas/shared/contracts/memo: the
 * finished Weekly Memo for the dashboard, and its PDF printout.
 */
import { Effect } from "effect";
import * as contract from "@css-atlas/shared/contracts/memo";
import { implement } from "../http/endpoint.js";
import { getWeeklyMemo, memoWeek } from "../services/weekly-memo.service.js";
import { renderWeeklyMemoPdf } from "../services/weekly-memo-pdf.service.js";
import { getWeeklyMemoReport, weeklyMemoPdfFilename } from "../services/weekly-memo-report.service.js";
import { ConflictError, UnavailableError } from "../utils/domain-error.js";

export const memoEndpoints = [
  implement(contract.getWeeklyMemo, ({ query }, caller) => getWeeklyMemo(query.week_num, caller.asOf)),

  implement(contract.getPdf, ({ query }, caller) =>
    Effect.gen(function* () {
      const week = memoWeek(query.week_num, caller.asOf);
      if (week == null) return yield* new ConflictError({ message: "The academic year has not started." });
      const report = yield* Effect.promise(() => getWeeklyMemoReport(week));
      const body = yield* Effect.tryPromise({
        try: () => renderWeeklyMemoPdf(report),
        catch: () => new UnavailableError({ message: "PDF generation failed. Please try again." }),
      });
      return { contentType: "application/pdf", filename: weeklyMemoPdfFilename(week, report.printedAtSlug), body };
    }),
  ),
];
