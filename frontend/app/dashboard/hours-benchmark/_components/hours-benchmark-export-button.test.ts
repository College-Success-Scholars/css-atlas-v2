import { afterEach, describe, expect, it, vi } from "vitest";

import {
  downloadHoursBenchmarkPdf,
  hoursBenchmarkClientPdfFilename,
} from "./hours-benchmark-export-button";

describe("hoursBenchmarkClientPdfFilename", () => {
  it("uses Eastern time in the fallback filename", () => {
    expect(hoursBenchmarkClientPdfFilename(new Date("2026-10-27T16:00:00.000Z"))).toBe(
      "hours-benchmark-2026-10-27-1200.pdf",
    );
    expect(hoursBenchmarkClientPdfFilename(new Date("2026-10-27T16:00:00.000Z"), "all")).toBe(
      "hours-benchmark-all-2026-10-27-1200.pdf",
    );
  });
});

describe("downloadHoursBenchmarkPdf", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("downloads from the same-origin Next proxy with the requested scope", async () => {
    const click = vi.fn();
    const revokeObjectURL = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({
        "content-type": "application/pdf",
        "content-disposition": 'attachment; filename="hours-benchmark-weeks-2-8-all-2026-10-27-1200.pdf"',
      }),
      blob: async () => new Blob(["%PDF"], { type: "application/pdf" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:pdf",
      revokeObjectURL,
    });
    vi.stubGlobal("document", {
      createElement: (tag: string) => {
        if (tag === "a") return { click, href: "", download: "" };
        throw new Error(`Unexpected createElement(${tag})`);
      },
    });

    await downloadHoursBenchmarkPdf("all");

    expect(fetchMock).toHaveBeenCalledWith("/api/hours-benchmark/pdf?scope=all");
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:pdf");
  });
});
