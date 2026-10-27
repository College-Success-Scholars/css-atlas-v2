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

import { pdf, report } from "../controllers/hours-benchmark.controller.js";

function response() {
  const result = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    set(headers: Record<string, string> | string, value?: string) {
      if (typeof headers === "string") {
        this.headers[headers] = value ?? "";
      } else {
        this.headers = headers;
      }
      return this;
    },
    send(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return result;
}

describe("hours benchmark controller", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getHoursBenchmarkReport.mockResolvedValue({
      scoredWeeks: { fromWeek: 2, throughWeek: 8 },
      printedAtSlug: "2026-10-27-1200",
      summary: { studentsAtOrBelow50AtLeastOnce: 0, atOrBelow50Events: 0, zeroPercentEvents: 0, studentsMissed80AtLeastOnce: 0 },
      heatmapScholars: [],
      byTeamLeader: [],
      lowEvents: [],
    });
    renderHoursBenchmarkPdf.mockResolvedValue(Buffer.from("pdf"));
  });

  it("returns JSON report data", async () => {
    const res = response();
    await report({} as never, res as never);
    expect(getHoursBenchmarkReport).toHaveBeenCalled();
    expect(res.headers["Cache-Control"]).toBe("no-store, max-age=0");
    expect(res.body).toEqual({
      data: expect.objectContaining({ scoredWeeks: { fromWeek: 2, throughWeek: 8 } }),
    });
  });

  it("delivers a downloadable PDF", async () => {
    const res = response();
    await pdf({} as never, res as never);
    expect(renderHoursBenchmarkPdf).toHaveBeenCalled();
    expect(res.headers).toMatchObject({
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="hours-benchmark-weeks-2-8-2026-10-27-1200.pdf"',
      "Cache-Control": "no-store, max-age=0",
    });
    expect(res.body).toEqual(Buffer.from("pdf"));
  });

  it("returns a retryable error when rendering fails", async () => {
    renderHoursBenchmarkPdf.mockRejectedValue(new Error("Chromium unavailable"));
    const res = response();
    await pdf({} as never, res as never);
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: "PDF generation failed. Please try again." });
  });
});
