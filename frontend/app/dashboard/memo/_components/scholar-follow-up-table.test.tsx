import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

import { ScholarFollowUpTable } from "./scholar-follow-up-table"
import type { ScholarFollowUpRow } from "../types"

const rows: ScholarFollowUpRow[] = [
  {
    scholarName: "Bob Scholar",
    scholarYear: "Sophomore",
    teamLeader: "TL One",
    flags: ["Low front desk completion", "Low study session completion", "Low grade", "Missing WAHF"],
    issues: [
      { kind: "front-desk", glance: "Front desk", pct: 50, requiredMinutes: 120, insideMinutes: 24, outsideMinutes: 6 },
      { kind: "study-session", glance: "Study session", pct: 70, requiredMinutes: 120, insideMinutes: 40, outsideMinutes: 44 },
      { kind: "grade", glance: "X · Y", pct: 60 },
      { kind: "wahf", glance: "WAHF", status: "missing", submittedAtLabel: null },
    ],
    frontDeskPct: 50,
    studySessionPct: 70,
    fdRequired: 120,
    ssRequired: 120,
  },
  {
    scholarName: "Late Scholar",
    scholarYear: "Freshman",
    teamLeader: "TL Two",
    flags: ["Low front desk completion"],
    issues: [{ kind: "front-desk", glance: "Front desk", pct: 40, requiredMinutes: 120 }],
    frontDeskPct: 90,
    studySessionPct: 91,
    fdRequired: 120,
    ssRequired: 120,
  },
]

describe("ScholarFollowUpTable", () => {
  it("splits glance labels from how-missing indicators", () => {
    const html = renderToStaticMarkup(<ScholarFollowUpTable rows={rows} />)

    expect(html).toContain("Scholar")
    expect(html).toContain("TL")
    expect(html).toContain("What&#x27;s missing")
    expect(html).toContain("How it&#x27;s missing")
    expect(html).not.toContain(">Issues<")

    expect(html).toContain("Front desk")
    expect(html).toContain("Study session")
    expect(html).toContain("X · Y")
    expect(html).toContain("WAHF")
    expect(html).toContain("No submission")
    expect(html).not.toContain("Front desk 50%")
    expect(html).not.toContain("X · Y 60%")

    expect(html).toContain("50%")
    expect(html).toContain("of 120 min")
    expect(html).toContain("70%")
    expect(html).toContain("24 min inside")
    expect(html).toContain("6 min outside")
    expect(html).toContain("40 min inside")
    expect(html).toContain("44 min outside")
    expect(html).toContain("60%")
    expect(html).toContain("40%")
    expect(html).not.toContain("90%")
    expect(html).toContain("TL One")
    expect(html).toContain("TL Two")
  })
})
