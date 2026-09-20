// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { downloadWeeklyMemoPdf, WeeklyMemoExportButton, weeklyMemoPdfFilename } from "./weekly-memo-export-button"

describe("WeeklyMemoExportButton", () => {
  it("is unavailable until memo data is available", () => {
    const { container } = render(<WeeklyMemoExportButton available={false} weekNumber={null} />)
    expect(container.innerHTML).toBe("")
  })

  it("shows progress and prevents duplicate exports", async () => {
    let finishExport: (() => void) | undefined
    const onExport = vi.fn(() => new Promise<void>((resolve) => { finishExport = resolve }))
    render(<WeeklyMemoExportButton available weekNumber={5} onExport={onExport} />)

    const button = screen.getByRole("button", { name: "Export PDF" })
    fireEvent.click(button)
    fireEvent.click(button)

    expect(onExport).toHaveBeenCalledTimes(1)
    expect((screen.getByRole("button", { name: "Generating PDF..." }) as HTMLButtonElement).disabled).toBe(true)

    finishExport?.()
    await waitFor(() => expect((screen.getByRole("button", { name: "Export PDF" }) as HTMLButtonElement).disabled).toBe(false))
  })

  it("reports a failed export and permits retry", async () => {
    const onExport = vi.fn().mockRejectedValueOnce(new Error("failed")).mockResolvedValueOnce(undefined)
    render(<WeeklyMemoExportButton available weekNumber={5} onExport={onExport} />)

    fireEvent.click(screen.getByRole("button", { name: "Export PDF" }))
    expect((await screen.findByRole("alert")).textContent).toContain("PDF generation failed")

    fireEvent.click(screen.getByRole("button", { name: "Export PDF" }))
    await waitFor(() => expect(onExport).toHaveBeenCalledTimes(2))
  })

  it("uses the selected week and Eastern time in the fallback filename", () => {
    expect(weeklyMemoPdfFilename(12, new Date("2026-09-04T23:39:00.000Z"))).toBe("weekly-memo-week-12-2026-09-04-1939.pdf")
  })

  it("downloads from the same-origin Next proxy", async () => {
    const click = vi.fn()
    const revokeObjectURL = vi.fn()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({
        "content-type": "application/pdf",
        "content-disposition": 'attachment; filename="weekly-memo-week-5-2026-09-04-1939.pdf"',
      }),
      blob: async () => new Blob(["%PDF"], { type: "application/pdf" }),
    })
    vi.stubGlobal("fetch", fetchMock)
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:pdf",
      revokeObjectURL,
    })
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "a") return { click, href: "", download: "" } as unknown as HTMLAnchorElement
      return originalCreateElement(tag)
    })

    await downloadWeeklyMemoPdf(5)

    expect(fetchMock).toHaveBeenCalledWith("/api/memo/pdf?weekNumber=5")
    expect(click).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:pdf")
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })
})
