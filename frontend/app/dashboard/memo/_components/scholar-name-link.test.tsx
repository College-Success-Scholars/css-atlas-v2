import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

import { ScholarNameLink } from "./scholar-name-link"

describe("ScholarNameLink", () => {
  it("links mentees to the directory scholar page", () => {
    const html = renderToStaticMarkup(
      <ScholarNameLink scholarId="uid/1" isMentee>
        Alice Scholar
      </ScholarNameLink>
    )

    expect(html).toContain('href="/dashboard/directory/uid%2F1"')
    expect(html).toContain("Alice Scholar")
  })

  it("keeps non-mentees as plain text", () => {
    const html = renderToStaticMarkup(
      <ScholarNameLink scholarId="uid-1" isMentee={false}>
        Bob Scholar
      </ScholarNameLink>
    )

    expect(html).toContain("Bob Scholar")
    expect(html).not.toContain("<a")
  })

  it("keeps scholars without a UID as plain text", () => {
    const html = renderToStaticMarkup(
      <ScholarNameLink isMentee>Unknown Scholar</ScholarNameLink>
    )

    expect(html).toContain("Unknown Scholar")
    expect(html).not.toContain("<a")
  })
})
