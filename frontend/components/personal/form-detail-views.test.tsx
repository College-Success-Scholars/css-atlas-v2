// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { FormDetailFooter } from "./form-detail-views"

describe("FormDetailFooter", () => {
  afterEach(cleanup)

  it("offers Workday on the WPL tab by default", () => {
    render(<FormDetailFooter formType="WPL" status="Not submitted" />)
    expect(screen.getByRole("link", { name: /^Open Workday/ })).toBeDefined()
    expect(screen.getByText("Not submitted")).toBeDefined()
  })

  it("hides Workday in read-only mode but keeps the status", () => {
    render(<FormDetailFooter formType="WPL" status="Submitted Thu · on time" readOnly />)
    expect(screen.queryByRole("link", { name: /^Open Workday/ })).toBeNull()
    expect(screen.getByText("Submitted Thu · on time")).toBeDefined()
  })

  it("never shows Workday outside the WPL tab", () => {
    render(<FormDetailFooter formType="WAHF" status="Not submitted" />)
    expect(screen.queryByRole("link", { name: /^Open Workday/ })).toBeNull()
  })
})
