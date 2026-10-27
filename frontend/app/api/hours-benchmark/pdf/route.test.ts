import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getHoursBenchmarkPdf = vi.fn();

vi.mock("@/lib/server/data", () => ({
  getHoursBenchmarkPdf,
}));

function request(scope?: string) {
  const url = new URL("http://localhost/api/hours-benchmark/pdf");
  if (scope) url.searchParams.set("scope", scope);
  return new NextRequest(url);
}

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
    const response = await GET(request());
    expect(getHoursBenchmarkPdf).toHaveBeenCalledWith("low");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("hours-benchmark-weeks-2-8");
    expect(await response.text()).toBe("pdf-bytes");
  });

  it("forwards scope=all to the backend download helper", async () => {
    getHoursBenchmarkPdf.mockResolvedValue(
      new Response("pdf-bytes", {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition":
            'attachment; filename="hours-benchmark-weeks-2-8-all-2026-10-27-1200.pdf"',
        },
      }),
    );
    const { GET } = await import("./route");
    const response = await GET(request("all"));
    expect(getHoursBenchmarkPdf).toHaveBeenCalledWith("all");
    expect(response.status).toBe(200);
  });

  it("reports a failed launch as 503", async () => {
    getHoursBenchmarkPdf.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const { GET } = await import("./route");
    const down = await GET(request());
    expect(down.status).toBe(503);
    await expect(down.json()).resolves.toEqual({ error: "PDF generation failed. Please try again." });
  });
});
