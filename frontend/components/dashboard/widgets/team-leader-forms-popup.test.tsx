// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { TeamLeaderFormsPopup, type TeamLeaderSelection } from "./team-leader-forms-popup";

const api = vi.hoisted(() => ({ backendPost: vi.fn() }));
vi.mock("@/lib/client/api-client", () => api);

const selection: TeamLeaderSelection = {
  person: {
    id: "p-1",
    name: "Jordan Ellis",
    uid: "111",
    cohort: 2024,
    email: "jellis@terpmail.umd.edu",
    phoneNumber: "240-555-0114",
    teams: ["Tutoring"],
    programRole: "Team Leader I",
    isMentee: false,
  },
  teamLeader: { uid: "111", mentee_count: 2, mentee_uids: ["201", "202"] },
};

// Week 7 is Oct 12–18, week 8 Oct 19–25 and week 9 (current) Oct 26–Nov 1.
const responses: Record<string, unknown> = {
  "/api/form-logs/whaf/by-uids": [
    { id: "w8", created_at: "2026-10-20T15:00:00Z", scholar_name: "Jordan Ellis", tl_meeting_in_person: "Yes", course_changes: "No", assignment_grades: { CMSC351: { "HW 6": "92" }, ENGL101: { "Essay 2": "B+" } }, missed_classes: "None", missed_assignments: "None" },
    { id: "w7", created_at: "2026-10-16T15:00:00Z", scholar_name: "Jordan Ellis", assignment_grades: null, missed_classes: "None", missed_assignments: "None" },
  ],
  "/api/form-logs/wpl/by-uids": [
    { id: "p7", created_at: "2026-10-16T15:00:00Z", full_name: "Jordan Ellis", hours_worked: 6.5, met_with_all: "No", explanation: "Covered two extra front desk shifts.", projects: [] },
    { id: "p6", created_at: "2026-10-09T15:00:00Z", full_name: "Jordan Ellis", hours_worked: 5, met_with_all: "Yes", explanation: "Left over from an earlier week.", projects: [] },
  ],
  "/api/form-logs/mcf/by-uids": [
    { id: "m8", created_at: "2026-10-21T15:00:00Z", mentor_uid: "111", mentee_uid: "201", mentee_name: "Ava Thompson", meeting_date: "2026-10-21", met_in_person: "Yes", tasks_completed: "Front Desk" },
  ],
  "/api/users/scholar-names": { "201": "Ava Thompson", "202": "Noah Kim" },
};

function renderPopup() {
  render(<TeamLeaderFormsPopup selection={selection} onClose={() => {}} />);
  return screen.getByRole("dialog");
}

async function loaded(dialog: HTMLElement) {
  return within(dialog).findByRole("button", { name: "Week 8 WAHF: On time" });
}

describe("TeamLeaderFormsPopup", () => {
  beforeEach(() => {
    // jsdom has no matchMedia; useIsMobile reads window.innerWidth after subscribing.
    window.matchMedia = vi.fn().mockReturnValue({ addEventListener() {}, removeEventListener() {} });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-28T16:00:00Z"));
    api.backendPost.mockImplementation(async (path: string) => ({ ok: true, data: responses[path] }));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    api.backendPost.mockReset();
  });

  it("loads the TL's forms once, with MCF read by mentor", async () => {
    const dialog = renderPopup();
    await loaded(dialog);
    expect(api.backendPost).toHaveBeenCalledWith("/api/form-logs/whaf/by-uids", { uids: ["111"] });
    expect(api.backendPost).toHaveBeenCalledWith("/api/form-logs/wpl/by-uids", { uids: ["111"] });
    expect(api.backendPost).toHaveBeenCalledWith("/api/form-logs/mcf/by-uids", { uids: ["111"], field: "mentor_uid" });
    expect(api.backendPost).toHaveBeenCalledWith("/api/users/scholar-names", { uids: ["201", "202"] });
    expect(api.backendPost).toHaveBeenCalledTimes(4);
  });

  it("shows who the team leader is", async () => {
    const dialog = renderPopup();
    expect(within(dialog).getByRole("heading", { name: /Jordan Ellis/ }).textContent).toContain("UID 111");
    expect(within(dialog).getByText("Team Leader I · Cohort 2024")).toBeDefined();
    expect(within(dialog).getByText("jellis@terpmail.umd.edu · 240-555-0114")).toBeDefined();
    await loaded(dialog);
  });

  it("shows skeletons until the forms arrive", async () => {
    const dialog = renderPopup();
    expect(within(dialog).getByLabelText("Loading forms")).toBeDefined();
    await loaded(dialog);
    expect(within(dialog).queryByLabelText("Loading forms")).toBeNull();
  });

  it("grades every started week the way Personal does and locks future weeks", async () => {
    const dialog = renderPopup();
    await loaded(dialog);
    const cell = (name: string) => within(dialog).getByRole("button", { name });
    expect(cell("Week 7 WAHF: Late")).toBeDefined();
    expect(cell("Week 8 WPL: Missing")).toBeDefined();
    expect(cell("Week 8 MCF: Partial, 1 of 2 mentees").textContent).toBe("1/2");
    expect(cell("Week 9 WAHF: Not yet due").getAttribute("aria-pressed")).toBe("true");
    expect(cell("Week 10 WAHF: not started").hasAttribute("disabled")).toBe(true);
    expect(within(dialog).getByText("Now")).toBeDefined();
  });

  it("selects a week from the grid and returns to this week", async () => {
    const dialog = renderPopup();
    await loaded(dialog);
    expect(within(dialog).getByRole("heading", { name: /^Week 9 · / })).toBeDefined();
    expect(within(dialog).queryByRole("button", { name: "Back to this week" })).toBeNull();

    fireEvent.click(within(dialog).getByRole("button", { name: "Week 8 WPL: Missing" }));
    expect(within(dialog).getByRole("heading", { name: /^Week 8 · / })).toBeDefined();
    expect(within(dialog).getByRole("tab", { name: /^WPL/ }).getAttribute("aria-selected")).toBe("true");
    expect(within(dialog).getByText("No WPL was submitted for week 8.")).toBeDefined();

    fireEvent.click(within(dialog).getByRole("button", { name: "Back to this week" }));
    expect(within(dialog).getByRole("heading", { name: /^Week 9 · / })).toBeDefined();
  });

  it("opens submissions read-only, with WAHF grades and no Submit or Workday shortcut", async () => {
    const dialog = renderPopup();
    await loaded(dialog);
    fireEvent.click(within(dialog).getByRole("button", { name: "Week 8 WAHF: On time" }));
    expect(within(dialog).getByText("CMSC351 · HW 6").nextElementSibling?.textContent).toBe("92");
    expect(within(dialog).getByText("ENGL101 · Essay 2").nextElementSibling?.textContent).toBe("B+");
    fireEvent.click(within(dialog).getByRole("tab", { name: /^WPL/ }));
    expect(within(dialog).queryByRole("link", { name: /Open Workday/ })).toBeNull();
    expect(within(dialog).queryByRole("link", { name: /Submit/ })).toBeNull();
  });

  it("lays WAHF out with the key facts first", async () => {
    const dialog = renderPopup();
    await loaded(dialog);
    fireEvent.click(within(dialog).getByRole("button", { name: "Week 8 WAHF: On time" }));
    const fact = (label: string) => within(dialog).getByText(label).closest("div")?.querySelector("dd")?.textContent;
    expect(fact("Scholar")).toBe("Jordan Ellis");
    expect(fact("Submitted")).toBe("Tue Oct 20");
    expect(fact("TL meeting in person")).toBe("Yes");
    expect(within(dialog).getByText("Course changes")).toBeDefined();
    expect(within(dialog).queryByText("Additional details")).toBeNull();
  });

  it("explains a WPL only when the TL didn't meet every scholar", async () => {
    const dialog = renderPopup();
    await loaded(dialog);
    fireEvent.click(within(dialog).getByRole("button", { name: "Week 7 WPL: On time" }));
    const met = within(dialog).getByText("Met with all scholars").parentElement!;
    expect(met.nextElementSibling?.textContent).toBe("ExplanationCovered two extra front desk shifts.");
    expect(within(dialog).queryByText("Additional details")).toBeNull();

    fireEvent.click(within(dialog).getByRole("button", { name: "Week 6 WPL: On time" }));
    expect(within(dialog).queryByText("Explanation")).toBeNull();
    expect(within(dialog).queryByText("Left over from an earlier week.")).toBeNull();
  });

  it("lists the TL's mentees and shows each one's MCF or says none was submitted", async () => {
    const dialog = renderPopup();
    await loaded(dialog);
    fireEvent.click(within(dialog).getByRole("button", { name: "Week 8 MCF: Partial, 1 of 2 mentees" }));
    const ava = within(dialog).getByRole("button", { name: /Ava Thompson/ });
    expect(ava.getAttribute("aria-pressed")).toBe("true");
    expect(within(dialog).getByText("Front Desk")).toBeDefined();

    fireEvent.click(within(dialog).getByRole("button", { name: /Noah Kim/ }));
    expect(within(dialog).getByText("Not submitted for Noah Kim this week.")).toBeDefined();
  });

  it("offers a retry when the forms can't load", async () => {
    api.backendPost.mockImplementation(async (path: string) =>
      path === "/api/form-logs/wpl/by-uids" ? { ok: false, status: 403, error: "Forbidden" } : { ok: true, data: responses[path] },
    );
    const dialog = renderPopup();
    expect((await within(dialog).findByRole("alert")).textContent).toContain("Couldn't load these forms.");
    api.backendPost.mockImplementation(async (path: string) => ({ ok: true, data: responses[path] }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Try again" }));
    await loaded(dialog);
  });

  it("opens as a bottom sheet at phone width", async () => {
    const width = window.innerWidth;
    window.innerWidth = 390;
    try {
      render(<TeamLeaderFormsPopup selection={selection} onClose={() => {}} />);
      await waitFor(() => expect(document.querySelector('[data-slot="sheet-content"]')).not.toBeNull());
      await loaded(screen.getByRole("dialog"));
    } finally {
      window.innerWidth = width;
    }
  });
});
