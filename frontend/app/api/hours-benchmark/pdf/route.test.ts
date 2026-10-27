import { beforeEach, describe, expect, it, vi } from "vitest";

const getHoursBenchmarkPdf = vi.fn();

vi.mock("@/lib/server/data", () => ({
  getHoursBenchmarkPdf,
}));

describe("GET /api/hours-benchmark/pdf", () => {
  beforeEach(() => {
    getHoursBenchmarkPdf.mockReset();
  });

  it("forwards the backend PDF and filename", async () => {
    getHoursBenchmarkPdf.mockResolvedValue(
      new Response("pdf-bytes", {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition":
            'attachment; filename="hours-benchmark-weeks-2-8-2026-10-27-1200.pdf"',
        },
      }),
    );
    const { GET } = await import("./route");
    const response = await GET();
    expect(getHoursBenchmarkPdf).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("hours-benchmark-weeks-2-8");
    expect(await response.text()).toBe("pdf-bytes");
  });

  it("reports a failed launch as 503", async () => {
    getHoursBenchmarkPdf.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const { GET } = await import("./route");
    const down = await GET();
    expect(down.status).toBe(503);
    await expect(down.json()).resolves.toEqual({ error: "PDF generation failed. Please try again." });
  });
});
