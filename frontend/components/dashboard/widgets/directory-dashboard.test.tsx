// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { DirectoryDashboard } from "./directory-dashboard";

const api = vi.hoisted(() => ({ backendGet: vi.fn(), backendPost: vi.fn() }));
vi.mock("@/lib/client/api-client", () => api);
const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const person = (id: string, name: string, uid: string) => ({
  id,
  name,
  uid,
  cohort: 2024,
  email: null,
  phoneNumber: null,
  teams: [],
  programRole: null,
  isMentee: false,
});

const directory = {
  view: "flat",
  members: [person("p-1", "Jordan Ellis", "111"), person("p-2", "Sam Rivera", "222")],
  pagination: { total: 2, range: { start: 1, end: 2 }, hasNext: false, nextCursor: null },
};

describe("DirectoryDashboard pins", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue({ addEventListener() {}, removeEventListener() {} });
    api.backendGet.mockImplementation(async (path: string) =>
      path.startsWith("/api/users/directory/facets")
        ? { ok: true, data: { teams: [], programRoles: [], cohorts: [] } }
        : { ok: true, data: directory },
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    localStorage.clear();
  });

  const pinnedSection = () => screen.getByRole("heading", { name: "Pinned" }).closest("section") as HTMLElement;

  it("starts empty and explains how to pin", async () => {
    render(<DirectoryDashboard viewerId="viewer-a" />);
    await screen.findByText("Sam Rivera");
    expect(within(pinnedSection()).getByText(/No one pinned yet/)).toBeDefined();
  });

  it("pins a person into the Pinned section and keeps them for the next visit", async () => {
    const { unmount } = render(<DirectoryDashboard viewerId="viewer-a" />);
    fireEvent.click(await screen.findByRole("button", { name: "Pin Sam Rivera" }));
    expect(within(pinnedSection()).getByText("Sam Rivera")).toBeDefined();
    expect(within(pinnedSection()).getByRole("button", { name: "Unpin Sam Rivera" }).getAttribute("aria-pressed")).toBe("true");
    unmount();

    render(<DirectoryDashboard viewerId="viewer-a" />);
    await waitFor(() => expect(within(pinnedSection()).getByText("Sam Rivera")).toBeDefined());
  });

  it("only shows a viewer their own pins", async () => {
    localStorage.setItem("directory:pins:viewer-a", JSON.stringify([directory.members[1]]));
    render(<DirectoryDashboard viewerId="viewer-b" />);
    await screen.findByText("Sam Rivera");
    expect(within(pinnedSection()).queryByText("Sam Rivera")).toBeNull();
  });

  it("hides everyone else when Pinned only is on", async () => {
    localStorage.setItem("directory:pins:viewer-a", JSON.stringify([directory.members[1]]));
    render(<DirectoryDashboard viewerId="viewer-a" />);
    await screen.findByText("Jordan Ellis");
    fireEvent.click(screen.getByRole("button", { name: /Pinned only/ }));
    expect(screen.queryByText("Jordan Ellis")).toBeNull();
    expect(screen.queryByText("All members")).toBeNull();
    expect(within(pinnedSection()).getByText("Sam Rivera")).toBeDefined();
  });

  it("unpins without opening the person", async () => {
    localStorage.setItem("directory:pins:viewer-a", JSON.stringify([directory.members[1]]));
    render(<DirectoryDashboard viewerId="viewer-a" />);
    await waitFor(() => expect(within(pinnedSection()).getByText("Sam Rivera")).toBeDefined());
    fireEvent.click(within(pinnedSection()).getByRole("button", { name: "Unpin Sam Rivera" }));
    expect(within(pinnedSection()).queryByText("Sam Rivera")).toBeNull();
    expect(screen.queryByText(/Profile details are coming soon/)).toBeNull();
    expect(JSON.parse(localStorage.getItem("directory:pins:viewer-a") ?? "[]")).toEqual([]);
  });
});

describe("DirectoryDashboard team leader popup", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue({ addEventListener() {}, removeEventListener() {} });
    api.backendGet.mockImplementation(async (path: string) => {
      if (path === "/api/users/team-leaders") return { ok: true, data: [{ uid: "111", mentee_count: 0, mentee_uids: [] }] };
      if (path.startsWith("/api/users/directory/facets")) return { ok: true, data: { teams: [], programRoles: [], cohorts: [] } };
      return { ok: true, data: directory };
    });
    api.backendPost.mockResolvedValue({ ok: true, data: [] });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    localStorage.clear();
  });

  const row = async (name: string) => (await screen.findByText(name)).closest('[role="button"]') as HTMLElement;

  it("opens the popup when Enter is pressed on a team leader row", async () => {
    render(<DirectoryDashboard canViewTeamLeaderForms />);
    await waitFor(() => expect(api.backendGet).toHaveBeenCalledWith("/api/users/team-leaders"));
    fireEvent.keyDown(await row("Jordan Ellis"), { key: "Enter" });
    expect(await screen.findByRole("heading", { name: /Jordan Ellis/ })).toBeDefined();
    expect(screen.getByText(/Semester forms/)).toBeDefined();
  });

  it("keeps the existing modal for everyone else", async () => {
    render(<DirectoryDashboard canViewTeamLeaderForms />);
    await waitFor(() => expect(api.backendGet).toHaveBeenCalledWith("/api/users/team-leaders"));
    fireEvent.keyDown(await row("Sam Rivera"), { key: "Enter" });
    expect(await screen.findByText(/Profile details are coming soon/)).toBeDefined();
    expect(screen.queryByText(/Semester forms/)).toBeNull();
  });

  it("never loads team leaders or opens the popup below team_leader", async () => {
    render(<DirectoryDashboard canViewTeamLeaderForms={false} />);
    fireEvent.keyDown(await row("Jordan Ellis"), { key: "Enter" });
    expect(await screen.findByText(/Profile details are coming soon/)).toBeDefined();
    expect(api.backendGet).not.toHaveBeenCalledWith("/api/users/team-leaders");
    expect(api.backendPost).not.toHaveBeenCalled();
  });
});
