import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getWeeklyMemoReport, renderWeeklyMemoPdf } = vi.hoisted(() => ({
  getWeeklyMemoReport: vi.fn(),
  renderWeeklyMemoPdf: vi.fn(),
}));

vi.mock("../services/weekly-memo-report.service.js", () => ({
  getWeeklyMemoReport,
  weeklyMemoPdfFilename: (weekNumber: number, slug: string) => `weekly-memo-week-${weekNumber}-${slug}.pdf`,
}));
vi.mock("../services/weekly-memo-pdf.service.js", () => ({ renderWeeklyMemoPdf }));

import { memoEndpoints } from "../controllers/memo.controller.js";
import { errorHandler } from "../http/error-handler.js";

/** The bound endpoints without the auth gate, so only the handler and lifecycle are under test. */
function appForEndpoints() {
  const app = express();
  for (const { contract, handle } of memoEndpoints) app.get(contract.path, handle);
  app.use(errorHandler);
  return app;
}

const binary = (res: request.Request) =>
  res.buffer(true).parse((response, done) => {
    const chunks: Buffer[] = [];
    response.on("data", (chunk: Buffer) => chunks.push(chunk));
    response.on("end", () => done(null, Buffer.concat(chunks)));
  });

describe("memo PDF", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getWeeklyMemoReport.mockResolvedValue({ weekNumber: 9, printedAtSlug: "2026-09-04-2039" });
    renderWeeklyMemoPdf.mockResolvedValue(Buffer.from("pdf"));
  });

  it("delivers the selected week as a downloadable PDF", async () => {
    const res = await binary(request(appForEndpoints()).get("/api/memo/pdf?week_num=9"));
    expect(getWeeklyMemoReport).toHaveBeenCalledWith(9);
    expect(res.status).toBe(200);
    expect(res.headers).toMatchObject({
      "content-type": "application/pdf",
      "content-disposition": 'attachment; filename="weekly-memo-week-9-2026-09-04-2039.pdf"',
      "cache-control": "no-store, max-age=0",
    });
    expect(res.body).toEqual(Buffer.from("pdf"));
  });

  it("returns a retryable error when rendering fails", async () => {
    renderWeeklyMemoPdf.mockRejectedValue(new Error("Chromium unavailable"));
    const res = await request(appForEndpoints()).get("/api/memo/pdf?week_num=9");
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: "PDF generation failed. Please try again." });
  });
});
