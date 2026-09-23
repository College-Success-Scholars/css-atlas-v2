// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ThemeToggle } from "./theme-toggle"

vi.mock("next-themes", () => ({
  useTheme: () => ({ setTheme: vi.fn(), theme: "system" }),
}))

describe("ThemeToggle", () => {
  it("gives the icon trigger an explicit accessible name and title", () => {
    render(<ThemeToggle />)

    const trigger = screen.getByRole("button", { name: "Toggle light/dark mode" })
    expect(trigger.getAttribute("title")).toBe("Toggle light/dark mode")
  })
})
