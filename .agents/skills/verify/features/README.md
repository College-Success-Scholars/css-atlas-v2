# CSS Atlas verification map

This map describes user-facing checks for the frontend. Read the package's [verify skill](../SKILL.md) for launch, doctor, browser isolation, evidence, and cleanup.

## Baseline

- Use an owned frontend and a fresh named Chrome session. The public launcher needs no account or seeded application data.
- All commands run from the repository root. `AB` in recipes means the complete named agent-browser invocation from the skill, not an installed alias.
- Capture the command/action and resulting snapshot or screenshot. Record URL, feature ID, entry point, exit status, and unmet prerequisites.
- Never replace a failed populated journey with an empty-state check and report the original as passing.
- Mutations need explicit approval, a confirmed isolated target, and persistence evidence. No seeds, migrations, onboarding, email, Slack, or valid traffic submissions by default.
- The developer persona switcher is not a disposable account or blanket write protection.
- Authenticated journeys are blocked without an approved account, completed profile, effective role, backend, and suitable calendar/roster data. The public launcher intentionally has no backend.

## Features

| Feature | Entry points | Coverage status |
| --- | --- | --- |
| [Landing-to-login](landing.md) | `/`, hero `Sign in` | Browser proof in `.audit/verify-runs/landing-20261114-01/` |
| [Authentication](authentication.md) | `/auth/login`, protected `/dashboard` | Form rendering proved through landing; session and dashboard unverified |
| [Traffic kiosk](traffic.md) | `/traffic` | Source-grounded; validation and write journeys unverified |
| [Mentee monitoring](mentees.md) | `/dashboard/mentee`, mentee/week controls and URL parameters | Source-grounded; account/data prerequisites unmet |
| [Weekly memo](weekly-memo.md) | `/dashboard/memo`, legacy `/memo`, week controls | Source-grounded; account/data prerequisites unmet |

The map is a starting set, not a complete inventory of every Atlas feature. A pass on one entry point does not cover other listed entry points. Keep proof artifacts after cleanup and do not commit student data.
