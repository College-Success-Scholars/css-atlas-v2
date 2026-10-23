// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import type { PersonalClientProps } from "@/lib/types/supabase"
import { PersonalClient } from "./personal-client"

const fixture = vi.hoisted(() => ({ history: false, isLate: false, completeMcf: false, daysLeft: 0, hoursLeft: 20 }))

vi.mock("./utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./utils")>()
  return {
    ...actual,
    computeWeekOptions: () => fixture.history ? [{ weekNum: 1, label: "Oct 12–Oct 18", isCurrent: false }] : [],
    canBrowseMcf: () => true,
    getFormStatusForWeek: (formType: string) => ({
      formType,
      status: fixture.history ? (formType === "MCF" && !fixture.completeMcf ? "incomplete" : "done") : "pending",
      hoursLeft: fixture.hoursLeft,
      daysLeft: fixture.daysLeft,
      completedCount: fixture.history ? (formType === "MCF" && fixture.completeMcf ? 2 : 1) : 0,
      requiredCount: fixture.history && formType === "MCF" ? 2 : 1,
      submittedAt: fixture.history ? "2026-10-15T18:30:00Z" : null,
      submission: fixture.history ? { created_at: "2026-10-15T18:30:00Z" } : null,
      isLate: fixture.isLate,
    }),
  }
})

describe("personal form card layout", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    fixture.history = false
    fixture.isLate = false
    fixture.completeMcf = false
    fixture.daysLeft = 0
    fixture.hoursLeft = 20
  })

  it.each([
    { daysLeft: 0, hoursLeft: 20, label: "20 hours left" },
    { daysLeft: 0, hoursLeft: 1, label: "1 hour left" },
    { daysLeft: 1, hoursLeft: 18, label: "1 day left" },
    { daysLeft: 3, hoursLeft: 66, label: "3 days left" },
    { daysLeft: 0, hoursLeft: 0, label: "Due soon" },
  ])("shows $label on the left with compact mentee progress on the right", ({ daysLeft, hoursLeft, label }) => {
    fixture.daysLeft = daysLeft
    fixture.hoursLeft = hoursLeft
    const props = {
      profile: { first_name: "Test", mentee_count: 1 },
      wahf: [], mcf: [], wpl: [], mentees: [], currentCampusWeek: 1,
    } as unknown as PersonalClientProps
    const container = document.createElement("div")
    container.innerHTML = renderToStaticMarkup(<PersonalClient {...props} />)
    expect(container.firstElementChild?.classList.contains("max-w-3xl")).toBe(true)

    for (const formType of ["WAHF", "WPL", "MCF"]) {
      const title = Array.from(container.querySelectorAll("p")).find((p) => p.textContent === formType)!
      const card = title.closest('[data-slot="card-content"]')!
      const summary = Array.from(card.querySelectorAll("p")).find((p) => p.textContent === label)!
      expect(summary).toBeDefined()
      expect(summary.parentElement?.classList.contains("justify-between")).toBe(true)
      const actions = card.nextElementSibling!
      expect(actions.classList.contains("grid-cols-1")).toBe(true)
      expect(summary.parentElement?.classList.contains("mt-auto")).toBe(false)
      expect(card.classList.contains("flex-1")).toBe(true)
      expect(actions.querySelectorAll('[data-slot="button"]')).toHaveLength(1)
      for (const action of actions.querySelectorAll('[data-slot="button"]')) {
        expect(action.classList.contains("w-full")).toBe(true)
        expect(action.classList.contains("h-10")).toBe(true)
        expect(action.classList.contains("rounded-none")).toBe(true)
      }
      expect(actions.querySelector("a")?.textContent).toContain("Submit")
      expect(actions.querySelector("a .lucide-external-link")).not.toBeNull()
      if (formType === "MCF") {
        expect(summary.nextElementSibling?.textContent).toBe("0/1 mentees")
        expect(summary.nextElementSibling?.getAttribute("aria-label")).toBe("0 of 1 mentees")
        expect(summary.nextElementSibling?.classList.contains("ml-auto")).toBe(true)
        expect(actions.querySelector("button")).toBeNull()
      }
    }
  })

  function renderHistory() {
    fixture.history = true
    const props = {
      profile: { first_name: "Test", mentee_count: 2 },
      wahf: [], mcf: [], wpl: [], mentees: [], currentCampusWeek: 2,
    } as unknown as PersonalClientProps
    const container = document.createElement("div")
    container.innerHTML = renderToStaticMarkup(<PersonalClient {...props} />)
    return container.querySelector("h3")!.parentElement!.parentElement!
  }

  it("splits the MCF footer into equal View and Submit actions after a partial submission", () => {
    const history = renderHistory()
    const page = history.closest(".space-y-8")!
    const title = Array.from(page.querySelectorAll("p")).find((p) => p.textContent === "MCF")!
    const card = title.closest('[data-slot="card-content"]')!
    const actions = card.nextElementSibling!
    expect(actions.classList.contains("grid-cols-2")).toBe(true)
    expect(actions.querySelectorAll('[data-slot="button"]')).toHaveLength(2)
    expect(actions.querySelector("button .lucide-eye")).not.toBeNull()
    expect(actions.querySelector("a .lucide-external-link")).not.toBeNull()
    expect(actions.querySelector("a")?.textContent).toContain("Submit")
  })

  it("shows only a full-width View footer when all MCF submissions are complete", () => {
    fixture.completeMcf = true
    const history = renderHistory()
    const page = history.closest(".space-y-8")!
    const title = Array.from(page.querySelectorAll("p")).find((p) => p.textContent === "MCF")!
    const actions = title.closest('[data-slot="card-content"]')!.nextElementSibling!
    expect(actions.classList.contains("grid-cols-1")).toBe(true)
    expect(actions.querySelectorAll('[data-slot="button"]')).toHaveLength(1)
    expect(actions.querySelector("button .lucide-eye")).not.toBeNull()
    expect(actions.querySelector("a")).toBeNull()
  })

  it("replaces weekly form pills with a right-aligned, spaced date range", () => {
    const history = renderHistory()
    const header = history.querySelector("h3")!.parentElement!
    expect(header.querySelector("h3")?.textContent).toBe("Week 1")
    expect(header.querySelector("p")?.textContent).toBe("Oct 12 - Oct 18")
    expect(header.querySelector("p")?.classList.contains("ml-auto")).toBe(true)
    expect(header.querySelector('[data-slot="badge"]')).toBeNull()
    expect(history.getAttribute("data-slot")).toBe("card")
    expect(history.getAttribute("aria-labelledby")).toBe(header.querySelector("h3")?.id)
    expect(header.classList.contains("border-b")).toBe(true)
    expect(header.classList.contains("bg-muted/40")).toBe(true)
    expect(header.querySelector("h3")?.classList.contains("font-semibold")).toBe(true)
    expect(history.querySelectorAll("button .lucide-eye")).toHaveLength(3)
  })

  it("keeps timestamps aligned without mentee prefixes or on-time text", () => {
    const history = renderHistory()
    const descriptions = Array.from(history.querySelectorAll("p"))
      .filter((p) => p.textContent?.startsWith("Submitted "))
    expect(descriptions).toHaveLength(3)
    expect(new Set(descriptions.map((p) => p.textContent)).size).toBe(1)
    expect(descriptions.every((p) => p.classList.contains("text-xs"))).toBe(true)
    expect(history.textContent).not.toContain("on time")
    expect(history.textContent).toContain("1 of 2 mentees")
    const progress = Array.from(history.querySelectorAll("span"))
      .find((span) => span.textContent === "1 of 2 mentees")!
    expect(progress.parentElement?.querySelector("p")?.textContent).toBe("MCF")
    expect(history.textContent).toContain("Incomplete")
    expect(history.querySelectorAll("button .lucide-eye")).toHaveLength(3)
  })

  it("retains late warnings in submission history", () => {
    fixture.isLate = true
    const history = renderHistory()
    const descriptions = Array.from(history.querySelectorAll("p"))
      .filter((p) => p.textContent?.startsWith("Submitted "))
    expect(descriptions).toHaveLength(3)
    expect(descriptions.every((p) => p.textContent?.endsWith(" · late"))).toBe(true)
  })

  function renderInteractivePage() {
    const props = {
      profile: { first_name: "Test", mentee_count: 2 },
      wahf: [], mcf: [], wpl: [], mentees: [], currentCampusWeek: 2,
    } as unknown as PersonalClientProps
    return render(<PersonalClient {...props} />)
  }

  it("offers Workday before submission and requests a separate, isolated window", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null)
    renderInteractivePage()
    const shortcut = screen.getByRole("link", { name: /^Open Workday/ })
    expect(shortcut.getAttribute("href")).toBe("https://www.myworkday.com/umd/login-saml2.htmld")
    expect(shortcut.getAttribute("target")).toBe("_blank")
    expect(shortcut.getAttribute("rel")).toBe("noopener noreferrer")
    expect(screen.getByText("Enter your hours in Workday")).toBeDefined()
    fireEvent.click(shortcut)
    expect(open).toHaveBeenCalledExactlyOnceWith(
      "https://www.myworkday.com/umd/login-saml2.htmld",
      "_blank",
      "popup=yes,width=1100,height=800,noopener,noreferrer",
    )
  })

  it("also offers Workday in the WPL dialog without closing the form", () => {
    fixture.history = true
    const open = vi.spyOn(window, "open").mockReturnValue(null)
    const { container } = renderInteractivePage()
    const title = Array.from(container.querySelectorAll("p")).find((p) => p.textContent === "WPL")!
    const view = title.closest('[data-slot="card-content"]')!.nextElementSibling!.querySelector("button")!
    fireEvent.click(view)
    const dialog = screen.getByRole("dialog")
    expect(within(dialog).getByRole("tab", { name: "WPL" }).getAttribute("aria-selected")).toBe("true")
    fireEvent.click(within(dialog).getByRole("link", { name: /^Open Workday/ }))
    expect(open).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("dialog")).toBe(dialog)
    fireEvent.click(within(dialog).getByRole("tab", { name: "WAHF" }))
    expect(within(dialog).queryByRole("link", { name: /^Open Workday/ })).toBeNull()
  })
})
