/**
 * @file hours-benchmark.controller.ts
 * @module backend/controllers
 *
 * Request handlers for the Hours Benchmark Report (/api/hours-benchmark/*).
 */
import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import {
  getHoursBenchmarkReport,
  hoursBenchmarkPdfFilename,
} from "../services/hours-benchmark.service.js";
import { renderHoursBenchmarkPdf } from "../services/hours-benchmark-pdf.service.js";

// GET /api/hours-benchmark
export async function report(_req: AuthenticatedRequest, res: Response) {
  try {
    const data = await getHoursBenchmarkReport();
    res.set("Cache-Control", "no-store, max-age=0");
    res.json({ data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to build hours benchmark report" });
  }
}

// GET /api/hours-benchmark/pdf
export async function pdf(_req: AuthenticatedRequest, res: Response) {
  try {
    const reportData = await getHoursBenchmarkReport();
    const document = await renderHoursBenchmarkPdf(reportData);
    const filename = hoursBenchmarkPdfFilename(reportData.scoredWeeks, reportData.printedAtSlug);
    res.set({
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
      "Content-Length": String(document.length),
    });
    res.send(document);
  } catch (e) {
    console.error(e);
    res.status(503).json({ error: "PDF generation failed. Please try again." });
  }
}
