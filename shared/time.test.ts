import { describe, expect, it } from "vitest";
import {
  FALL_SEMESTER_FIRST_DAY,
  freshmanCohortYear,
  isCollectionYearStarted,
  isHourEligibleCohort,
  parseEasternDate,
  scholarYearGroupLabel,
  scholarYearLabel,
  sophomoreCohortYear,
} from "./time.js";

describe("isCollectionYearStarted", () => {
  it("is false before FALL_SEMESTER_FIRST_DAY", () => {
    const fallStart = parseEasternDate(FALL_SEMESTER_FIRST_DAY);
    const dayBefore = new Date(fallStart.getTime() - 24 * 60 * 60 * 1000);
    expect(isCollectionYearStarted(dayBefore)).toBe(false);
  });

  it("is true on FALL_SEMESTER_FIRST_DAY", () => {
    const fallStart = parseEasternDate(FALL_SEMESTER_FIRST_DAY);
    // Noon Eastern on Fall start so weekOf is unambiguous.
    const onStart = new Date(fallStart.getTime() + 12 * 60 * 60 * 1000);
    expect(isCollectionYearStarted(onStart)).toBe(true);
  });

  it("is true after FALL_SEMESTER_FIRST_DAY", () => {
    const fallStart = parseEasternDate(FALL_SEMESTER_FIRST_DAY);
    const weekLater = new Date(fallStart.getTime() + 8 * 24 * 60 * 60 * 1000);
    expect(isCollectionYearStarted(weekLater)).toBe(true);
  });
});

describe("hour-eligible cohort years", () => {
  const freshman = Number.parseInt(FALL_SEMESTER_FIRST_DAY.slice(0, 4), 10);
  const sophomore = freshman - 1;

  it("derives freshman and sophomore years from FALL_SEMESTER_FIRST_DAY", () => {
    expect(freshmanCohortYear()).toBe(freshman);
    expect(sophomoreCohortYear()).toBe(sophomore);
  });

  it("treats only freshman and sophomore cohorts as hour-eligible", () => {
    expect(isHourEligibleCohort(freshman)).toBe(true);
    expect(isHourEligibleCohort(sophomore)).toBe(true);
    expect(isHourEligibleCohort(freshman - 2)).toBe(false);
    expect(isHourEligibleCohort(null)).toBe(false);
  });

  it("labels freshman and sophomore years", () => {
    expect(scholarYearLabel(freshman)).toBe("Freshman");
    expect(scholarYearLabel(sophomore)).toBe("Sophomore");
    expect(scholarYearLabel(freshman - 2)).toBeNull();
    expect(scholarYearLabel(null)).toBeNull();
  });

  it("labels freshman and sophomore cohort groups in the plural", () => {
    expect(scholarYearGroupLabel(freshman)).toBe("Freshmen");
    expect(scholarYearGroupLabel(sophomore)).toBe("Sophomores");
    expect(scholarYearGroupLabel(freshman - 2)).toBeNull();
    expect(scholarYearGroupLabel(null)).toBeNull();
  });
});
