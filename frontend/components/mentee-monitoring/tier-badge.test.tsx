import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import { TierBadge } from "./tier-badge"

// Markup contracts; the browser regression checks the actual tier CSS.
vi.mock("./tier-styles.module.css", () => ({ default: {} }))

describe("TierBadge", () => {
  describe.each([
    { context: "default font", className: undefined, fontClass: "text-[12px]" },
    { context: "legend font override", className: "text-[11px]", fontClass: "text-[11px]" },
  ])("$context", ({ className, fontClass }) => {
    it.each(["rare", "epic", "legendary"] as const)(
      "gives %s the common size, alignment, and padding",
      (tier) => {
        const html = renderToStaticMarkup(<TierBadge tier={tier} className={className} />)
        const classes = html.match(/class="([^"]+)"/)?.[1].split(" ") ?? []

        expect(classes).toEqual(expect.arrayContaining([
          "inline-flex",
          "h-[22px]",
          "w-[8em]",
          "shrink-0",
          "items-center",
          "justify-center",
          "px-2",
          "py-0.75",
          "align-middle",
          "whitespace-nowrap",
          fontClass,
        ]))
        if (className) {
          expect(classes).not.toContain("text-[12px]")
        }
      },
    )
  })

  it("renders Rare without an icon", () => {
    const html = renderToStaticMarkup(<TierBadge tier="rare" />)

    expect(html).toContain("Rare")
    expect(html).not.toContain("<svg")
  })

  it("reserves the gem for Epic", () => {
    const html = renderToStaticMarkup(<TierBadge tier="epic" />)

    expect(html).toContain("Epic")
    expect(html).toContain("lucide-gem")
  })

  it("keeps the crown for Legendary", () => {
    const html = renderToStaticMarkup(<TierBadge tier="legendary" />)

    expect(html).toContain("Legendary")
    expect(html).toContain("lucide-crown")
    expect(html).not.toContain("lucide-gem")
  })
})
