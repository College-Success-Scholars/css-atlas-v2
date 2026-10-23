// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TutorReportWeekRow } from "@/lib/types/tutor-report-log";

const mocks = vi.hoisted(() => ({ deleteTutorReportAction: vi.fn(), refresh: vi.fn(), push: vi.fn() }));
vi.mock("@/lib/server/actions", () => ({ deleteTutorReportAction: mocks.deleteTutorReportAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh, push: mocks.push }) }));
vi.mock("@/components/data-display/campus-week-nav", () => ({ CampusWeekUrlNav: () => <nav aria-label="Week navigation" /> }));
import { TeamsTutoringClient } from "./teams-tutoring-client";

const rows: TutorReportWeekRow[] = [
  { id: 7, created_at: "2026-09-08T19:14:00.000Z", date: "2026-09-08", tutor_name: "Grace Hopper", scholar_uid: "900000001", start_time: "14:00", end_time: "15:00", courses: ["Math140", "CS 110"], scholar_name: "Ada Lovelace", day_of_week: "Tue" },
  { id: 8, created_at: "2026-09-09T18:30:00.000Z", date: "2026-09-09", tutor_name: "Alan Turing", scholar_uid: "n/a", start_time: "10:00", end_time: "11:00", courses: [], scholar_name: "EMPTY SESSION", day_of_week: "Wed" },
];
const groupMember: TutorReportWeekRow = { ...rows[0], id: 9, scholar_uid: "900000002", scholar_name: "Katherine Johnson", courses: ["MATH 140", "Bmgt220"] };
function renderClient(data: TutorReportWeekRow[] | null = rows, overrides = {}) {
  return render(<TeamsTutoringClient basePath="/dashboard/teams/tutoring" weekNum={2} currentCampusWeek={4} rows={data} error={null} {...overrides} />);
}
function openRow(name: RegExp = /Open session: Ada Lovelace/) { fireEvent.click(screen.getByRole("button", { name })); }

describe("TeamsTutoringClient", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.deleteTutorReportAction.mockReset(); });
  afterEach(cleanup);

  it("shows a selected-week subtitle, current-week action, and no excluded features", () => {
    renderClient();
    expect(screen.getByText(/^Week 2 ·/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "This week" }));
    expect(mocks.push).toHaveBeenCalledWith("/dashboard/teams/tutoring?week=4");
    expect(screen.queryByRole("button", { name: /Export|Needs review|Fix/ })).toBeNull();
  });

  it("disables This week when already selected", () => {
    renderClient(rows, { weekNum: 4 });
    expect((screen.getByRole("button", { name: "This week" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps search text readable and its label stacked above the input", () => {
    renderClient();
    const input = screen.getByRole("textbox", { name: "Search" });
    expect(input.className).toContain("md:text-base");
    expect(input.className).toContain("font-normal");
    expect(input.closest("label")?.className).toContain("flex-col");
    expect(input.closest("label")?.className).toContain("text-sm");
  });

  it("shows an empty week and loading/error states without inventing rows", () => {
    const { unmount } = renderClient([]);
    expect(screen.getByText("No tutoring sessions this week.")).toBeTruthy();
    unmount();
    renderClient(null, { error: "Could not load reports" });
    expect(screen.getByRole("alert").textContent).toBe("Could not load reports");
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("uses course chips, 12-hour times, and a dash for empty scholars", () => {
    renderClient();
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Tutor", "Time", "Scholar", "Courses"]);
    expect(within(screen.getByRole("table")).getByText("MATH140").closest('[data-slot="badge"]')).toBeTruthy();
    expect(within(screen.getByRole("table")).getByText("CS110")).toBeTruthy();
    expect(screen.getByText("2:00–3:00 PM")).toBeTruthy();
    expect(screen.queryByText("EMPTY SESSION")).toBeNull();
    expect(screen.getByRole("button", { name: /Open session: —/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Tue, Sep 8" })).toBeTruthy();
  });

  it("warns about an unmatched scholar without displaying the UID or a fake Fix action", () => {
    renderClient([{ ...rows[0], scholar_name: "900000001" }]);
    expect(screen.getByText("Unmatched ID")).toBeTruthy();
    expect(screen.queryByText("900000001")).toBeNull();
    expect(screen.queryByRole("button", { name: /Fix/ })).toBeNull();
  });

  it("combines same-block forms and counts tutor-hours only once", () => {
    renderClient([rows[0], groupMember]);
    expect(screen.getByText("Group · 2 scholars")).toBeTruthy();
    expect(screen.getAllByText("2 forms · 1 hr · 0 empty sessions")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /Open session:/ })).toHaveLength(1);
    expect(within(screen.getByRole("table")).getByText("BMGT220")).toBeTruthy();
    expect(within(screen.getByRole("table")).getAllByText("MATH140")).toHaveLength(1);
  });

  it("sorts times numerically within each date and does not merge different tutors or dates", () => {
    renderClient([
      { ...rows[0], id: 1, start_time: "14:30", end_time: "15:30" },
      { ...rows[0], id: 2, start_time: "13:00", end_time: "14:00" },
      { ...rows[0], id: 3, tutor_name: "Other Tutor", start_time: "1:00 PM", end_time: "2:00 PM" },
      { ...rows[0], id: 4, date: "2026-09-09", day_of_week: "Wed", start_time: "13:00", end_time: "14:00" },
    ]);
    const dataRows = screen.getAllByRole("row").filter((row) => within(row).queryByRole("button", { name: /Open session:/ }));
    expect(dataRows).toHaveLength(4);
    expect(dataRows[0].textContent).toContain("1:00–2:00 PM");
    expect(dataRows[1].textContent).toContain("1:00–2:00 PM");
    expect(dataRows[2].textContent).toContain("2:30–3:30 PM");
  });

  it("searches and intersects normalized course and tutor filters, with clear/no-match states", () => {
    renderClient([rows[0], groupMember, rows[1]]);
    fireEvent.change(screen.getByRole("textbox", { name: "Search" }), { target: { value: "Katherine" } });
    expect(screen.getAllByRole("button", { name: /Open session:/ })).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Open session: Katherine/ })).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Course" }), { target: { value: "BMGT220" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Tutor" }), { target: { value: "alan turing" } });
    expect(screen.getByText("No forms match your filters.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getAllByRole("button", { name: /Open session:/ })).toHaveLength(2);
  });

  it("filters with/no scholar and treats unmatched IDs as supplied scholars", () => {
    renderClient([...rows, { ...groupMember, scholar_name: "900000002" }]);
    fireEvent.click(screen.getByRole("button", { name: "No scholar" }));
    expect(screen.getAllByRole("button", { name: /Open session:/ })).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Open session: —/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "With scholar" }));
    expect(screen.getByText("Group · 2 scholars")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Open session: —/ })).toBeNull();
  });

  it("finds course codes regardless of whitespace in search or stored code", () => {
    renderClient();
    fireEvent.change(screen.getByRole("textbox", { name: "Search" }), { target: { value: "math 140" } });
    expect(screen.getByRole("button", { name: /Open session: Ada/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Open session: —/ })).toBeNull();
  });

  it("groups by tutor or scholar without losing forms", () => {
    renderClient([rows[0], groupMember, rows[1]]);
    fireEvent.change(screen.getByRole("combobox", { name: "Group by" }), { target: { value: "tutor" } });
    expect(screen.getByRole("heading", { name: "Grace Hopper" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Day" })).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Group by" }), { target: { value: "scholar" } });
    expect(screen.getByRole("heading", { name: "Ada Lovelace" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Katherine Johnson" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "No scholar" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Open session:/ })).toHaveLength(3);
  });

  it("uses one tutor identity for grouping, filtering, and deduplicated hours", () => {
    renderClient([rows[0], { ...groupMember, tutor_name: " GRACE   HOPPER " }]);
    fireEvent.change(screen.getByRole("combobox", { name: "Group by" }), { target: { value: "tutor" } });
    expect(screen.getAllByRole("heading", { name: "Grace Hopper" })).toHaveLength(1);
    expect(screen.getAllByText("2 forms · 1 hr · 0 empty sessions")).toHaveLength(2);
    const tutors = screen.getByRole("combobox", { name: "Tutor" });
    expect(within(tutors).getAllByRole("option")).toHaveLength(2);
    fireEvent.change(tutors, { target: { value: "grace hopper" } });
    expect(screen.getByText("Group · 2 scholars")).toBeTruthy();
  });

  it("reveals and focuses inline details on narrower screens", () => {
    const width = window.innerWidth;
    window.innerWidth = 600;
    try {
      renderClient(); openRow();
      expect(document.activeElement).toBe(within(screen.getByRole("dialog")).getByRole("heading", { name: "Ada Lovelace" }));
    } finally { window.innerWidth = width; }
  });

  it("opens a nonmodal panel with consolidated date/time and receipt delay", () => {
    renderClient(); openRow();
    const panel = screen.getByRole("dialog");
    expect(panel.getAttribute("aria-modal")).toBe("false");
    expect(within(panel).getByText("Tue, Sep 8 · 2:00–3:00 PM (1 hr)")).toBeTruthy();
    expect(within(panel).getByText("Received 14 min after session ended")).toBeTruthy();
    expect(panel.textContent).not.toContain("900000001");
    expect(panel.textContent).not.toContain("Submitted");
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Open session: Ada/ }).closest("tr")?.getAttribute("data-state")).toBe("selected");
    openRow(/Open session: —/);
    expect(within(screen.getByRole("dialog")).getByText("Tutor: Alan Turing")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close details" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("steps through individual forms within a group using buttons and arrow keys", () => {
    renderClient([rows[0], groupMember, rows[1]]); openRow();
    expect(screen.getByText("Form 1 of 3")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Previous form" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Next form" }));
    expect(within(screen.getByRole("dialog")).getByRole("heading", { name: "Katherine Johnson" })).toBeTruthy();
    expect(screen.getByText("Form 2 of 3")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowDown" });
    expect(screen.getByText("Form 3 of 3")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Next form" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowUp" });
    expect(screen.getByText("Form 2 of 3")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("supports arrow navigation from a row button and closes stale selection on filtering", () => {
    renderClient();
    fireEvent.keyDown(screen.getByRole("button", { name: /Open session: Ada/ }), { key: "ArrowDown" });
    expect(screen.getByText("Form 2 of 2")).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "Search" }), { target: { value: "Ada" } });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("cancel on confirmation never calls delete and explains permanent removal", () => {
    renderClient([rows[0], groupMember]); openRow();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText(/This permanently removes one form from Week 2/)).toBeTruthy();
    expect(screen.getByText(/Other reports in the same block will remain/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Remove" }));
    expect(mocks.deleteTutorReportAction).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Remove" })).toBeTruthy();
  });

  it("deletes only the selected group member and refreshes existing data", async () => {
    mocks.deleteTutorReportAction.mockResolvedValue({ success: true });
    renderClient([rows[0], groupMember]); openRow();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove session" }));
    await waitFor(() => expect(mocks.deleteTutorReportAction).toHaveBeenCalledWith(7));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: /Open session: Katherine/ })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /Open session: Katherine/ }));
    expect(screen.getAllByText("1 form · 1 hr · 0 empty sessions")).toHaveLength(2);
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("restores focus to the list heading after removing the last form", async () => {
    mocks.deleteTutorReportAction.mockResolvedValue({ success: true });
    renderClient([rows[0]]); openRow();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove session" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Tutoring sessions" }));
  });

  it("blocks dismissal, row changes and duplicate requests while deleting", async () => {
    let resolve!: (value: { error: string }) => void;
    mocks.deleteTutorReportAction.mockReturnValue(new Promise((done) => { resolve = done; }));
    renderClient(); openRow();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove session" }));
    expect((screen.getByRole("button", { name: "Close details" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: /Open session: —/ }).closest("tr")!);
    expect(within(screen.getByRole("dialog")).getByRole("heading", { name: "Ada Lovelace" })).toBeTruthy();
    expect(mocks.deleteTutorReportAction).toHaveBeenCalledOnce();
    resolve({ error: "Forbidden" });
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Forbidden");
    expect(screen.getByRole("button", { name: /Open session: Ada/ })).toBeTruthy();
  });
});
