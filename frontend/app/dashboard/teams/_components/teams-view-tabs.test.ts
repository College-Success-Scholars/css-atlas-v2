import { describe, expect, it } from "vitest";
import { TEAMS_VIEW_TABS, visibleTeamsViewTabs } from "./teams-view-tabs";

const AM_PM = "/dashboard/teams/front-desk/am-pm";
const FRONT_DESK = "/dashboard/teams/front-desk";
const STUDY = "/dashboard/teams/study";

const hrefs = (activeHref: string) => visibleTeamsViewTabs(activeHref).map((t) => t.href);

describe("visibleTeamsViewTabs", () => {
  it("offers the AM/PM board from the front desk hours board", () => {
    expect(hrefs(FRONT_DESK)).toContain(AM_PM);
  });

  it("keeps the AM/PM board visible while on it", () => {
    expect(hrefs(AM_PM)).toContain(AM_PM);
  });

  it("hides the AM/PM board from the study sessions board", () => {
    expect(hrefs(STUDY)).not.toContain(AM_PM);
    expect(hrefs(STUDY)).toEqual([FRONT_DESK, STUDY]);
  });

  it("hides the AM/PM board from any non front-desk board", () => {
    expect(hrefs("/dashboard/teams/tutoring")).not.toContain(AM_PM);
  });

  it("always offers the hours and study boards", () => {
    for (const active of [FRONT_DESK, AM_PM, STUDY]) {
      expect(hrefs(active)).toContain(FRONT_DESK);
      expect(hrefs(active)).toContain(STUDY);
    }
  });

  it("never drops a tab that is not AM/PM", () => {
    const others = TEAMS_VIEW_TABS.filter((t) => t.href !== AM_PM).length;
    expect(hrefs(STUDY)).toHaveLength(others);
  });
});
