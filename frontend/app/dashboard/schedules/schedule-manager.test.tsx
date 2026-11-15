// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ScheduleManager } from "./schedule-manager";
import type { ScheduleBoard } from "@/lib/types/schedules";

const api = vi.hoisted(() => ({ put: vi.fn(), get: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: api.push }) }));
vi.mock("@/lib/client/api-client", () => ({ backendPut: api.put, backendGet: api.get }));

const board: ScheduleBoard = {
  semester: { id: 1, name: "Fall", startDate: "2026-09-01", endDate: "2026-12-18" },
  currentWeekStart: "2026-11-09", weekStart: "2026-11-09",
  scholars: [{ uid: "S1", name: "Sam One", cohort: null, classYearLabel: null, programRole: "Scholar", status: null,
    fd_required: 0, ss_required: 0, revision: 3,
    shifts: [{ id: "a1", kind: "front_desk", dayOfWeek: 1, startTime: "09:00", endTime: "10:00", effectiveFrom: "2026-09-01", effectiveUntil: "2026-12-19" }] }],
};

afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("scholar schedule editor", () => {
  it("moves a shift using an accessible day control and saves the loaded revision", async () => {
    api.put.mockResolvedValue({ ok: true, data: { ...board, scholar: { ...board.scholars[0], revision: 4, shifts: [] } } });
    render(<ScheduleManager initialBoard={board} />);
    fireEvent.change(screen.getByLabelText("Day 1"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Save schedule" }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith("/api/schedules/S1", {
      semesterId: 1, effectiveWeekStart: "2026-11-09", expectedRevision: 3,
      shifts: [{ kind: "front_desk", dayOfWeek: 4, startTime: "09:00", endTime: "10:00" }],
    }));
    expect(await screen.findByText("Schedule saved. Earlier weeks are unchanged.")).toBeTruthy();
  });

  it("adds and removes shifts and saves an empty schedule", async () => {
    api.put.mockResolvedValue({ ok: true, data: { ...board, scholar: { ...board.scholars[0], revision: 4, shifts: [] } } });
    render(<ScheduleManager initialBoard={board} />);
    fireEvent.click(screen.getByRole("button", { name: "Add shift" }));
    expect(screen.getAllByLabelText(/Session \d/)).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Remove shift 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove shift 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Save schedule" }));
    await waitFor(() => expect(api.put.mock.calls[0]?.[1].shifts).toEqual([]));
  });

  it("retains the draft and stale revision on a conflict until explicit reload", async () => {
    api.put.mockResolvedValue({ ok: false, status: 409, error: "Schedule changed. Reload latest." });
    api.get.mockResolvedValue({ ok: true, data: { ...board, scholars: [{ ...board.scholars[0], revision: 5 }] } });
    render(<ScheduleManager initialBoard={board} />);
    fireEvent.change(screen.getByLabelText("Start 1"), { target: { value: "08:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save schedule" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>("Start 1").value).toBe("08:00");
    fireEvent.click(screen.getByRole("button", { name: "Discard draft and reload latest" }));
    await screen.findByText("Latest schedule loaded. The previous draft was discarded.");
    expect(screen.getByLabelText<HTMLInputElement>("Start 1").value).toBe("09:00");
  });

  it("prevents duplicate saves and changing the selection while a save is pending", async () => {
    api.put.mockReturnValue(new Promise(() => {}));
    render(<ScheduleManager initialBoard={board} />);
    fireEvent.change(screen.getByLabelText("Day 1"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save schedule" }));
    fireEvent.click(screen.getByRole("button", { name: "Saving…" }));
    expect(api.put).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText<HTMLSelectElement>("Scholar").disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Discard changes" }).disabled).toBe(true);
  });

  it("keeps past weeks read-only", () => {
    render(<ScheduleManager initialBoard={{ ...board, weekStart: "2026-11-02" }} />);
    expect(screen.getByText("Past weeks are read-only.")).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Save schedule" }).disabled).toBe(true);
    expect(screen.getByLabelText("Day 1").closest("fieldset")?.disabled).toBe(true);
  });
});
