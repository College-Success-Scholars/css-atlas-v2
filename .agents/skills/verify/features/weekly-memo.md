# Weekly memo

Permitted team leaders review the weekly memo, navigate between campus weeks, and optionally download an export.

## Sub-features

- `memo-read` shows populated content for the selected campus week.
- `memo-weeks` changes weeks through navigation controls and bookmarks.
- `memo-legacy` reaches the memo through the legacy `/memo` entry.
- `memo-export` downloads a memo, only when export verification is requested.

## How to get to it (user POV)

- Open `/dashboard/memo` or a bookmark with `?week=<campus week>`.
- Open legacy `/memo` and follow its redirect.
- Use `Previous week`, `Next week`, and the hydrated `Export PDF` button.

## Driving it with agent-browser

Preconditions:

- Use an approved full-stack instance with a completed authenticated profile, team-leader-or-higher effective role, an active calendar, and known memo data for the selected weeks.
- The public frontend launcher has no backend and cannot prove this journey. Missing account/data prerequisites block it.
- Export additionally requires the backend's configured Chrome/Puppeteer setup and a run-owned download directory. Never install system dependencies or change backend config without permission. `AB` means the approved named browser invocation.

- **Read.** Open the approved origin's `/dashboard/memo` using `AB open`, then `AB snapshot`. Require H1 `Weekly memo` and actual memo content for the expected week. Wait for the asynchronous content and record any error, not just the header.
- **Navigate.** Run `AB find role button click --name "Previous week" --exact`, then `AB get url` and `AB snapshot`. Require the preceding week parameter and content. Run `AB find role button click --name "Next week" --exact` and verify restoration. Use known valid weeks, not boundary guesses.
- **Bookmark.** Open the approved origin's `/dashboard/memo?week=` plus the approved fixture's campus week number. Require matching heading/content and URL. Separately open `/memo`, observe its destination with `AB get url`, and require the same readable memo experience.
- **Requested export.** Use a fresh snapshot to identify `Export PDF`. Record the click and resulting download into this run's evidence directory. Require an OK response from `/api/memo/pdf?weekNumber=<selected week>`, content type `application/pdf`, a nonempty file named `weekly-memo-week-...`, and content matching the selected week. Inspect file metadata/header without creating a separate PDF workflow. A button click without a successful download fails this check.
- **Proof.** Retain navigation actions, before/after snapshots, URLs, export response status and filename if exercised, and any `[role="alert"]` error. Do not publish student content.

## Gotchas

- The header renders before asynchronous memo content. H1 visibility alone is not readiness.
- An empty week may be valid production behavior but does not satisfy a populated memo fixture.
- PDF export depends on backend browser availability and produces a local file. Exclude it from a no-file-write run.
- Initial proof exercised landing-to-login only; memo navigation, legacy entry, and export remain unverified.
