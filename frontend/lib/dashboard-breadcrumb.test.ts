import { describe, expect, it } from "vitest";
import { resolveDashboardBreadcrumb } from "./dashboard-breadcrumb";

describe("resolveDashboardBreadcrumb", () => {
  it("shows a single dashboard crumb on dashboard root", () => {
    expect(resolveDashboardBreadcrumb("/dashboard")).toEqual([{ label: "Dashboard" }]);
    expect(resolveDashboardBreadcrumb("/dashboard/")).toEqual([{ label: "Dashboard" }]);
  });

  it("shows dashboard link and page title on top-level sub-routes", () => {
    expect(resolveDashboardBreadcrumb("/dashboard/directory")).toEqual([
      { label: "Dashboard", href: "/dashboard" },
      { label: "Directory" },
    ]);
    expect(resolveDashboardBreadcrumb("/dashboard/memo")).toEqual([
      { label: "Dashboard", href: "/dashboard" },
      { label: "Memo" },
    ]);
    expect(resolveDashboardBreadcrumb("/dashboard/personal")).toEqual([
      { label: "Dashboard", href: "/dashboard" },
      { label: "Personal" },
    ]);
    expect(resolveDashboardBreadcrumb("/dashboard/mentee")).toEqual([
      { label: "Dashboard", href: "/dashboard" },
      { label: "Mentees" },
    ]);
    expect(resolveDashboardBreadcrumb("/dashboard/internship-board")).toEqual([
      { label: "Dashboard", href: "/dashboard" },
      { label: "Internship Board" },
    ]);
    expect(resolveDashboardBreadcrumb("/dashboard/events")).toEqual([
      { label: "Dashboard", href: "/dashboard" },
      { label: "Events" },
    ]);
    expect(resolveDashboardBreadcrumb("/dashboard/settings")).toEqual([
      { label: "Dashboard", href: "/dashboard" },
      { label: "Settings" },
    ]);
    expect(resolveDashboardBreadcrumb("/dashboard/room")).toEqual([
      { label: "Dashboard", href: "/dashboard" },
      { label: "Room" },
    ]);
    expect(resolveDashboardBreadcrumb("/dashboard/memo-legacy")).toEqual([
      { label: "Dashboard", href: "/dashboard" },
      { label: "Memo (Legacy)" },
    ]);
  });

  it("labels a directory scholar detail page without exposing the raw UID", () => {
    expect(resolveDashboardBreadcrumb("/dashboard/directory/123456789")).toEqual([
      { label: "Dashboard", href: "/dashboard" },
      { label: "Directory", href: "/dashboard/directory" },
      { label: "Scholar" },
    ]);
  });

  it("formats unknown path segments as a title", () => {
    expect(resolveDashboardBreadcrumb("/dashboard/some-new-page")).toEqual([
      { label: "Dashboard", href: "/dashboard" },
      { label: "Some New Page" },
    ]);
    expect(resolveDashboardBreadcrumb("/dashboard/some-new-page/nested-view")).toEqual([
      { label: "Dashboard", href: "/dashboard" },
      { label: "Some New Page", href: "/dashboard/some-new-page" },
      { label: "Nested View" },
    ]);
  });
});
