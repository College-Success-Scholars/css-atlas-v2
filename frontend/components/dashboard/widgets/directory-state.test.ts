import { describe, expect, it } from "vitest";
import { activeFilterCount, directoryPath, initialDirectoryState } from "./directory-state";

describe("directory state", () => {
  it("counts only selected facets", () => {
    expect(activeFilterCount({ team: "Study", programRole: "", cohort: "2026" })).toBe(2);
  });

  it("serializes the supported directory query contract", () => {
    expect(directoryPath({ ...initialDirectoryState, search: "Ada", team: "Study,Front Desk", cohort: "2026" }, "next", "Study"))
      .toBe("/api/users/directory?view=flat&sort=asc&search=Ada&team=Study%2CFront+Desk&cohort=2026&cursor=next&group=Study");
  });
});
