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

import { pdf } from "../controllers/memo.controller.js";

function response() {
  const result = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
    set(headers: Record<string, string>) { this.headers = headers; return this; },
    send(body: unknown) { this.body = body; return this; },
  };
  return result;
}

describe("memo PDF controller", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getWeeklyMemoReport.mockResolvedValue({ weekNumber: 9, printedAtSlug: "2026-09-04-2039" });
    renderWeeklyMemoPdf.mockResolvedValue(Buffer.from("pdf"));
  });

  it("delivers the selected week as a downloadable PDF", async () => {
    const res = response();
    await pdf({ query: { weekNumber: "9" } } as never, res as never);
    expect(getWeeklyMemoReport).toHaveBeenCalledWith(9);
    expect(res.headers).toMatchObject({
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=\"weekly-memo-week-9-2026-09-04-2039.pdf\"",
      "Cache-Control": "no-store, max-age=0",
    });
    expect(res.body).toEqual(Buffer.from("pdf"));
  });

  it("returns a retryable error when rendering fails", async () => {
    renderWeeklyMemoPdf.mockRejectedValue(new Error("Chromium unavailable"));
    const res = response();
    await pdf({ query: { weekNumber: "9" } } as never, res as never);
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: "PDF generation failed. Please try again." });
  });
});
