// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"

const mocks = vi.hoisted(() => ({ backendPut: vi.fn() }))

vi.mock("@/lib/client/api-client", () => ({ backendPut: mocks.backendPut }))

import { MeetingPreferenceEditor } from "./meeting-preference-editor"

const preference = { weekday: 3, meetingTime: "15:00" }

describe("MeetingPreferenceEditor", () => {
  beforeEach(() => {
    mocks.backendPut.mockReset()
    // jsdom lacks the pointer APIs used by the real Radix Select.
    Object.defineProperties(HTMLElement.prototype, {
      scrollIntoView: { value: vi.fn(), writable: true },
      hasPointerCapture: { value: vi.fn(() => false), writable: true },
      setPointerCapture: { value: vi.fn(), writable: true },
      releasePointerCapture: { value: vi.fn(), writable: true },
    })
  })

  afterEach(() => {
    cleanup()
  })

  it("opens a dialog outside the banner without replacing the meeting summary", () => {
    const { container } = render(
      <MeetingPreferenceEditor menteeUid="123456789" preference={preference} onSaved={vi.fn()} />,
    )
    const summary = screen.getByText(/Your meeting: Wednesday at/)
    const trigger = screen.getByRole("button", { name: "Change meeting time" })

    fireEvent.click(trigger)

    const dialog = screen.getByRole("dialog", { name: "Change meeting time" })
    expect(container.contains(summary)).toBe(true)
    expect(container.contains(dialog)).toBe(false)
    expect(container.querySelector("form")).toBeNull()
    expect(within(dialog).getByRole("combobox", { name: "Meeting weekday" }).textContent).toBe("Wednesday")
    expect((within(dialog).getByLabelText("Time") as HTMLInputElement).value).toBe("15:00")
  })

  it.each(["Cancel", "Escape"])("discards edits with %s, restores focus, and resets to the latest saved preference on open", async (action) => {
    const onSaved = vi.fn()
    const { rerender } = render(
      <MeetingPreferenceEditor menteeUid="123456789" preference={preference} onSaved={onSaved} />,
    )
    const trigger = screen.getByRole("button", { name: "Change meeting time" })
    fireEvent.click(trigger)
    fireEvent.change(screen.getByLabelText("Time"), { target: { value: "10:30" } })

    if (action === "Cancel") {
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    } else {
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    }

    expect(screen.queryByRole("dialog")).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
    expect(mocks.backendPut).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()

    rerender(
      <MeetingPreferenceEditor menteeUid="123456789" preference={{ weekday: 5, meetingTime: "16:30" }} onSaved={onSaved} />,
    )
    fireEvent.click(trigger)
    expect(screen.getByRole("combobox", { name: "Meeting weekday" }).textContent).toBe("Friday")
    expect((screen.getByLabelText("Time") as HTMLInputElement).value).toBe("16:30")
  })

  it.each([false, true])("uses Wednesday at 3pm defaults when no preference is saved (unavailable: %s)", (unavailable) => {
    render(
      <MeetingPreferenceEditor menteeUid="123456789" preference={null} unavailable={unavailable} onSaved={vi.fn()} />,
    )
    expect(screen.getByText(`Your meeting: ${unavailable ? "unavailable" : "not set"}`)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Change meeting time" }))

    expect(screen.getByRole("combobox", { name: "Meeting weekday" }).textContent).toBe("Wednesday")
    expect((screen.getByLabelText("Time") as HTMLInputElement).value).toBe("15:00")
  })

  it("saves the chosen weekday and time, closes, notifies the caller, and restores focus", async () => {
    mocks.backendPut.mockResolvedValue({ ok: true, data: { weekday: 5, meetingTime: "10:30" } })
    const onSaved = vi.fn()
    render(<MeetingPreferenceEditor menteeUid="mentee/123" preference={preference} onSaved={onSaved} />)
    const trigger = screen.getByRole("button", { name: "Change meeting time" })
    fireEvent.click(trigger)
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Meeting weekday" }), { key: "ArrowDown" })
    fireEvent.click(screen.getByRole("option", { name: "Friday" }))
    fireEvent.change(screen.getByLabelText("Time"), { target: { value: "10:30" } })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce())
    expect(mocks.backendPut).toHaveBeenCalledExactlyOnceWith(
      "/api/auth/mentees/mentee%2F123/meeting-preference",
      { weekday: 5, meetingTime: "10:30" },
    )
    expect(screen.queryByRole("dialog")).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
    expect(screen.getByText("Your meeting: Wednesday at 3:00pm")).toBeTruthy()
  })

  it("keeps failed saves open with the edits and error, then clears them when reopened", async () => {
    mocks.backendPut.mockResolvedValue({ ok: false, error: "Could not save meeting time", status: 500 })
    const onSaved = vi.fn()
    render(<MeetingPreferenceEditor menteeUid="123456789" preference={preference} onSaved={onSaved} />)
    const trigger = screen.getByRole("button", { name: "Change meeting time" })
    fireEvent.click(trigger)
    fireEvent.change(screen.getByLabelText("Time"), { target: { value: "10:30" } })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    expect((await screen.findByRole("alert")).textContent).toBe("Could not save meeting time")
    expect(screen.getByRole("dialog", { name: "Change meeting time" })).toBeTruthy()
    expect((screen.getByLabelText("Time") as HTMLInputElement).value).toBe("10:30")
    expect(onSaved).not.toHaveBeenCalled()
    expect(screen.getByText("Your meeting: Wednesday at 3:00pm")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    fireEvent.click(trigger)
    expect(screen.queryByRole("alert")).toBeNull()
    expect((screen.getByLabelText("Time") as HTMLInputElement).value).toBe("15:00")
  })

  it("blocks duplicate submissions and dismissal while saving, then allows retry after failure", async () => {
    let resolveSave!: (result: { ok: false; error: string; status: number }) => void
    mocks.backendPut.mockReturnValue(new Promise((resolve) => { resolveSave = resolve }))
    const onSaved = vi.fn()
    render(<MeetingPreferenceEditor menteeUid="123456789" preference={preference} onSaved={onSaved} />)
    fireEvent.click(screen.getByRole("button", { name: "Change meeting time" }))
    const form = screen.getByRole("button", { name: "Save" }).closest("form")!
    fireEvent.submit(form)

    const saveButton = screen.getByRole("button", { name: /Sav/ }) as HTMLButtonElement
    expect(saveButton.disabled).toBe(true)
    expect((screen.getByRole("combobox", { name: "Meeting weekday" }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByLabelText("Time") as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.submit(form)
    fireEvent.click(saveButton)
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(mocks.backendPut).toHaveBeenCalledOnce()
    expect(screen.getByRole("dialog")).toBeTruthy()
    expect(onSaved).not.toHaveBeenCalled()

    await act(async () => {
      resolveSave({ ok: false, error: "Try again", status: 503 })
    })
    expect(screen.getByRole("alert").textContent).toBe("Try again")
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(false)

    mocks.backendPut.mockResolvedValue({ ok: true, data: preference })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce())
    expect(mocks.backendPut).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole("dialog")).toBeNull()
  })
})
