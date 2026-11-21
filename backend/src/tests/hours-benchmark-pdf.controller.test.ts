import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getHoursBenchmarkReport, renderHoursBenchmarkPdf } = vi.hoisted(() => ({
  getHoursBenchmarkReport: vi.fn(),
  renderHoursBenchmarkPdf: vi.fn(),
}));

vi.mock("../services/hours-benchmark.service.js", async () => {
  const actual = await vi.importActual<typeof import("../services/hours-benchmark.service.js")>(
    "../services/hours-benchmark.service.js",
  );
  return {
    ...actual,
    getHoursBenchmarkReport,
  };
});
vi.mock("../services/hours-benchmark-pdf.service.js", () => ({ renderHoursBenchmarkPdf }));

import { hoursBenchmarkEndpoints } from "../controllers/hours-benchmark.controller.js";
import { errorHandler } from "../http/error-handler.js";

/** The bound handlers without the auth middleware, so the request lifecycle is what runs. */
function appForEndpoints() {
  const app = express();
  for (const { contract, handle } of hoursBenchmarkEndpoints) {
    app.get(contract.path, handle);
  }
  app.use(errorHandler);
  return app;
}

const report = {
  currentCampusWeek: 8,
  scoredWeeks: { fromWeek: 2, throughWeek: 8 },
  weekNumbers: [2, 3],
  weekRangeLabel: "Weeks 2-8",
  dateRangeLabel: "Sep 7 - Oct 25",
  preparedAtLabel: "Oct 27, 2026",
  printedAtSlug: "2026-10-27-1200",
  summary: { studentsAtOrBelow50AtLeastOnce: 0, atOrBelow50Events: 0, zeroPercentEvents: 0, studentsMissed80AtLeastOnce: 0 },
  heatmapScholars: [],
  allHeatmapScholars: [],
  byTeamLeader: [],
  lowEvents: [],
  tutoringByScholar: [],
  tutoringByTutor: [],
  tutoringByDay: [],
};

function pdfBytes(res: request.Response) {
  return res.body as Buffer;
}

describe("hours benchmark endpoints", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getHoursBenchmarkReport.mockResolvedValue(report);
    renderHoursBenchmarkPdf.mockResolvedValue(Buffer.from("pdf"));
  });

  it("returns JSON report data, never cached", async () => {
    const res = await request(appForEndpoints()).get("/api/hours-benchmark");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store, max-age=0");
    expect(res.body).toEqual({ data: report });
  });

  it("delivers a downloadable PDF", async () => {
    const res = await request(appForEndpoints())
      .get("/api/hours-benchmark/pdf")
      .buffer(true)
      .parse((response, done) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => done(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(renderHoursBenchmarkPdf).toHaveBeenCalledWith(report, "low");
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-disposition"]).toBe(
      'attachment; filename="hours-benchmark-weeks-2-8-2026-10-27-1200.pdf"',
    );
    expect(res.headers["cache-control"]).toBe("no-store, max-age=0");
    expect(pdfBytes(res).toString()).toBe("pdf");
  });

  it("delivers an all-scholars PDF when scope=all", async () => {
    const res = await request(appForEndpoints()).get("/api/hours-benchmark/pdf?scope=all");
    expect(res.status).toBe(200);
    expect(renderHoursBenchmarkPdf).toHaveBeenCalledWith(report, "all");
    expect(res.headers["content-disposition"]).toBe(
      'attachment; filename="hours-benchmark-weeks-2-8-all-2026-10-27-1200.pdf"',
    );
  });

  it("falls back to the low heatmap for an unknown scope", async () => {
    const res = await request(appForEndpoints()).get("/api/hours-benchmark/pdf?scope=everything");
    expect(res.status).toBe(200);
    expect(renderHoursBenchmarkPdf).toHaveBeenCalledWith(report, "low");
  });

  it("answers 503 with a retry message when rendering fails", async () => {
    renderHoursBenchmarkPdf.mockRejectedValue(new Error("Chromium unavailable"));
    const res = await request(appForEndpoints()).get("/api/hours-benchmark/pdf");
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: "PDF generation failed. Please try again." });
  });
});
