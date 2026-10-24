export type DashboardBreadcrumbItem = {
  label: string;
  href?: string;
};

const DASHBOARD_PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/directory": "Directory",
  "/dashboard/personal": "Personal",
  "/dashboard/mentee": "Mentees",
  "/dashboard/memo": "Memo",
  "/dashboard/memo-legacy": "Memo (Legacy)",
  "/dashboard/internship-board": "Internship Board",
  "/dashboard/events": "Events",
  "/dashboard/settings": "Settings",
  "/dashboard/room": "Room",
};

function formatPathSegment(segment: string): string {
  return segment
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function resolvePageLabel(path: string): string {
  const knownTitle = DASHBOARD_PAGE_TITLES[path];
  if (knownTitle) {
    return knownTitle;
  }

  const segment = path.split("/").pop();
  return segment ? formatPathSegment(segment) : "Dashboard";
}

/** Breadcrumb trail for the current dashboard route. */
export function resolveDashboardBreadcrumb(pathname: string): DashboardBreadcrumbItem[] {
  const path = pathname.replace(/\/$/, "") || "/dashboard";

  if (path === "/dashboard") {
    return [{ label: "Dashboard" }];
  }

  if (path.startsWith("/dashboard/directory/")) {
    return [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Directory", href: "/dashboard/directory" },
      { label: "Scholar" },
    ];
  }

  const routeSegments = path.split("/").filter(Boolean).slice(1);
  const items: DashboardBreadcrumbItem[] = [{ label: "Dashboard", href: "/dashboard" }];

  let cumulativePath = "/dashboard";
  for (let index = 0; index < routeSegments.length; index++) {
    cumulativePath += `/${routeSegments[index]}`;
    const label = resolvePageLabel(cumulativePath);
    const isLast = index === routeSegments.length - 1;

    items.push(isLast ? { label } : { label, href: cumulativePath });
  }

  return items;
}
