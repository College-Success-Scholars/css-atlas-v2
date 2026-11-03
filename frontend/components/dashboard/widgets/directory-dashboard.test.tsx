// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
