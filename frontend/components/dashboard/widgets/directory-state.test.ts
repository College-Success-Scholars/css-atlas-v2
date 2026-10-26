import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  directoryMenteePath,
  directoryPath,
  initialDirectoryState,
} from "./directory-state";

describe("directory state", () => {
  it("counts only selected facets", () => {
    expect(activeFilterCount({ team: "Study", programRole: "", cohort: "2026" })).toBe(2);
  });

  it("serializes the supported directory query contract", () => {
    expect(directoryPath({ ...initialDirectoryState, search: "Ada", team: "Study,Front Desk", cohort: "2026" }, "next", "Study"))
      .toBe("/api/users/directory?view=flat&sort=asc&search=Ada&team=Study%2CFront+Desk&cohort=2026&cursor=next&group=Study");
  });

  it("opens a detail page only for a mentee with a UID", () => {
    expect(directoryMenteePath("123/456", true)).toBe("/dashboard/directory/123%2F456");
    expect(directoryMenteePath("123456789", true, 2025)).toBe(
      "/dashboard/directory/123456789?cohort=2025",
    );
    expect(directoryMenteePath("123456789", false)).toBeNull();
    expect(directoryMenteePath(null, true)).toBeNull();
  });
});
