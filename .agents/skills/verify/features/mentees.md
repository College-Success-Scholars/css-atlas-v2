# Mentee monitoring

Team leaders review assigned mentees' weekly requirements and recent grades, select another mentee, and inspect earlier semester weeks.

## Sub-features

- `mentee-review` shows one assigned mentee's weekly requirements and recent grades.
- `mentee-switch` changes the selected mentee and URL.
- `mentee-week` changes the selected week and returns to the current week.
- `mentee-url` handles explicit week/UID parameters, unknown UIDs, and future weeks.

## How to get to it (user POV)

- Open `/dashboard/mentee` as a permitted team leader.
- Use `Switch mentee` when multiple mentees are assigned.
- Select a week in `Semester weeks by requirement`, or use a bookmark with `?week=<week>&uid=<assigned UID>`.
- Use `Back to this week` from a historical selection.

## Driving it with agent-browser

Preconditions:

- An approved full-stack instance, authenticated completed profile with the permitted effective role, known assigned mentees, active semester/calendar, and populated requirement/grade data are required.
- Two assigned mentees are required for switching. Record which approved fixtures satisfy each precondition without exposing student data.
- The public launcher is insufficient. Stop as blocked until these conditions are supplied; do not seed or impersonate by editing cookies. `AB` means a fresh named browser configured for the approved origin.

- **Review.** Open the approved origin's `/dashboard/mentee` with `AB open`, then `AB snapshot`. Require the expected mentee H1, group `Weekly requirements`, and complementary area `Recent grades`. Wait for content, not just the heading.
- **Switch.** Identify the select labeled `Switch mentee` using a snapshot. Run `AB select "#mentee-switcher"` with the second approved UID as its value. Snapshot again and run `AB get url`. Require the selected mentee's name and matching `uid` query parameter, then select the original approved UID and verify restoration.
- **Weeks.** From a fresh snapshot choose a past button named `Week N, ...` using its current ref with `AB click`. Run `AB get url` and snapshot. Require the intended `week` parameter and changed requirement content. Run `AB find role button click --name "Back to this week" --exact` and confirm current-week content returns.
- **Bookmarks.** Open an approved assigned UID and known past week directly, then verify both selections. Separately open a future week and unknown UID query. Require future-week clamping to current week and fallback to the first assigned mentee. Capture the final URL and rendered selections independently; do not infer one from the other.
- **Proof.** Save the selection actions, redacted before/after snapshots, URLs, and data-load errors for each entry point.

## Gotchas

- `Switch mentee` is absent with only one assigned mentee. This blocks switching coverage, rather than proving it.
- `No mentees yet` and `No active semester week` are distinct empty-state checks. They do not prove a populated review journey.
- Do not save meeting times, submit external MCF forms, or trigger follow-up actions during read-only checks.
- Initial skill proof did not execute this journey. Semester dates and fixture availability must be checked at run time.
