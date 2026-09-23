// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { TeamLeaderDashboard } from "./team-leader-dashboard"

describe("TeamLeaderDashboard", () => {
  it("shows a personalized concise heading and all destinations for mentee-enabled users", () => {
    render(<TeamLeaderDashboard firstName=" Ada " showMentees />)

    expect(screen.getByRole("heading", { level: 1, name: "Welcome back, Ada" })).toBeTruthy()
    expect(screen.getByRole("link", { name: /Personal/ }).getAttribute("href")).toBe("/dashboard/personal")
    expect(screen.getByRole("link", { name: /Mentees/ }).getAttribute("href")).toBe("/dashboard/mentee")
  })

  it("uses the generic heading and omits Mentees without access", () => {
    render(<TeamLeaderDashboard firstName="  " />)

    expect(screen.getByRole("heading", { level: 1, name: "Home" })).toBeTruthy()
    expect(screen.queryByRole("link", { name: /Mentees/ })).toBeNull()
  })

  it("uses the mobile-first grid and exposes each destination as a full-card link", () => {
    const { container } = render(<TeamLeaderDashboard />)
    const grid = container.querySelector(".grid")
    const personalLink = screen.getByRole("link", { name: /Personal/ })

    expect(grid?.classList.contains("grid-cols-1")).toBe(true)
    expect(grid?.classList.contains("sm:grid-cols-2")).toBe(true)
    expect(personalLink.classList.contains("block")).toBe(true)
    expect(personalLink.classList.contains("cursor-pointer")).toBe(true)
    expect(personalLink.classList.contains("hover:bg-accent")).toBe(true)
    expect(personalLink.classList.contains("active:bg-accent")).toBe(true)
    expect(personalLink.classList.contains("focus-visible:ring-2")).toBe(true)
    expect(personalLink.querySelector("svg.size-5.text-muted-foreground")).not.toBeNull()
  })
})
