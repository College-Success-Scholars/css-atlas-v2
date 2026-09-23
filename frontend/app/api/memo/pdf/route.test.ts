import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const getWeeklyMemoPdf = vi.fn()

vi.mock("@/lib/server/data", () => ({
  getWeeklyMemoPdf,
}))

describe("GET /api/memo/pdf", () => {
  beforeEach(() => {
    getWeeklyMemoPdf.mockReset()
  })

  it("rejects a missing or invalid weekNumber", async () => {
    const { GET } = await import("./route")
    const missing = await GET(new NextRequest("http://localhost/api/memo/pdf"))
    expect(missing.status).toBe(400)
    const invalid = await GET(new NextRequest("http://localhost/api/memo/pdf?weekNumber=0"))
    expect(invalid.status).toBe(400)
  })

  it("forwards the backend PDF and filename", async () => {
    getWeeklyMemoPdf.mockResolvedValue(new Response("pdf-bytes", {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="weekly-memo-week-5-2026-09-04-1939.pdf"',
      },
    }))
    const { GET } = await import("./route")
    const response = await GET(new NextRequest("http://localhost/api/memo/pdf?weekNumber=5"))
    expect(getWeeklyMemoPdf).toHaveBeenCalledWith(5)
    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("application/pdf")
    expect(response.headers.get("Content-Disposition")).toContain("weekly-memo-week-5")
    expect(await response.text()).toBe("pdf-bytes")
  })

  it("forwards a backend 503 and reports a failed launch as 503", async () => {
    getWeeklyMemoPdf.mockResolvedValueOnce(new Response(JSON.stringify({ error: "PDF generation failed. Please try again." }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    }))
    const { GET } = await import("./route")
    const failed = await GET(new NextRequest("http://localhost/api/memo/pdf?weekNumber=5"))
    expect(failed.status).toBe(503)

    getWeeklyMemoPdf.mockRejectedValueOnce(new Error("ECONNREFUSED"))
    const down = await GET(new NextRequest("http://localhost/api/memo/pdf?weekNumber=5"))
    expect(down.status).toBe(503)
    await expect(down.json()).resolves.toEqual({ error: "PDF generation failed. Please try again." })
  })
})
