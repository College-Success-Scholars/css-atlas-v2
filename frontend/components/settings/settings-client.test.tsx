// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { MenteeRow, ProfileRow } from "@/lib/types/supabase"
import SettingsClient from "./settings-client"

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  addMentee: vi.fn(),
  removeMentee: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}))

vi.mock("@/lib/server/actions", () => ({
  addMentee: mocks.addMentee,
  removeMentee: mocks.removeMentee,
}))

const profile = {
  id: "profile-1",
  first_name: "Grace",
  last_name: "Hopper",
  app_role: "team_leader",
} as ProfileRow

const mentees: MenteeRow[] = [
  {
    scholar_uid: "1001",
    first_name: "Ada",
    last_name: "Lovelace",
    fd_required: 60,
    ss_required: 30,
  },
]

const candidates = [
  { uid: "1002", first_name: "Katherine", last_name: "Johnson" },
]

function renderSettings(canManageMentees: boolean) {
  render(
    <SettingsClient
      profile={profile}
      mentees={mentees}
      candidates={candidates}
      canManageMentees={canManageMentees}
    />,
  )
  fireEvent.click(screen.getByRole("tab", { name: "Mentees" }))
}

describe("settings mentee management", () => {
  beforeEach(() => {
    mocks.refresh.mockReset()
    mocks.addMentee.mockReset()
    mocks.removeMentee.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it("hides add/remove controls when the viewer cannot manage mentees", () => {
    renderSettings(false)

    expect(screen.queryByRole("button", { name: "Add mentee" })).toBeNull()
    expect(screen.queryByRole("button", { name: /Remove Ada Lovelace/ })).toBeNull()
  })

  it("shows the add dialog for team leaders", () => {
    renderSettings(true)

    fireEvent.click(screen.getByRole("button", { name: "Add mentee" }))

    expect(screen.getByRole("heading", { name: "Add mentee" })).toBeTruthy()
    expect(screen.getByPlaceholderText("Search by name or UID")).toBeTruthy()
  })

  it("removes a mentee after confirmation", async () => {
    mocks.removeMentee.mockResolvedValue({ success: true })
    renderSettings(true)

    fireEvent.click(screen.getByRole("button", { name: "Remove Ada Lovelace" }))
    expect(screen.getByRole("heading", { name: "Remove mentee?" })).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Remove" }))

    await waitFor(() => expect(mocks.removeMentee).toHaveBeenCalledWith("1001"))
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled())
  })

  it("keeps the remove dialog open and shows the action error", async () => {
    mocks.removeMentee.mockResolvedValue({ error: "Team leader access required" })
    renderSettings(true)

    fireEvent.click(screen.getByRole("button", { name: "Remove Ada Lovelace" }))
    fireEvent.click(screen.getByRole("button", { name: "Remove" }))

    expect(await screen.findByText("Team leader access required")).toBeTruthy()
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
})
