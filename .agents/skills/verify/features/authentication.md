# Authentication

Users sign in with email and password and enter their protected dashboard. Visitors without a session return to login.

## Sub-features

- `login-form` displays labeled fields, password visibility, and remember-me controls.
- `login-session` signs an approved user in and reaches their dashboard.
- `login-guard` prevents an unauthenticated visitor from viewing `/dashboard`.

## How to get to it (user POV)

- Follow the public landing's `Sign in` link or open `/auth/login` directly.
- Open `/dashboard` without a session to exercise the guard.

## Driving it with agent-browser

Preconditions:

- Form/guard checks can use the owned public instance. Session verification cannot; it requires an approved full-stack instance, an existing account, and a completed profile.
- Use a separate fresh named browser per signed-in versus signed-out case. `AB` is defined in the skill. Use the approved instance's origin for full-stack work, not the public launcher's absent backend.
- Obtain credentials through the approved secret mechanism. Do not put passwords in CLI arguments, source, action logs, or screenshots. Stop as blocked if no safe credential entry mechanism is available.

- **Form.** Run `AB open http://127.0.0.1:4310/auth/login`, `AB wait --text "Login to CSS Atlas"`, and `AB snapshot`. Require `Email`, `Password`, `Remember me`, `Show password`, and `Sign In`. Do not hard-code generated field IDs.
- **Visibility.** With no real password entered, run `AB find role button click --name "Show password" --exact` and snapshot. Require `Hide password`; click it and confirm `Show password` returns.
- **Guard.** In a fresh signed-out session run `AB open http://127.0.0.1:4310/dashboard`, `AB wait --url "**/auth/login"`, and snapshot. Require the login heading and no protected data.
- **Session.** On the approved full-stack origin, use the form labels `Email` and `Password` through the safe credential mechanism, then `AB find role button click --name "Sign In" --exact`. Require `AB wait --url "**/dashboard"` and a snapshot of actual dashboard content after data loads. Reload and confirm the approved user's dashboard remains accessible. Capture no password or token values.
- **Proof.** Record each entry point independently, resulting URLs, redacted snapshots, and errors. A form appearing does not prove a successful session.

## Gotchas

- The public launcher points at an intentionally absent backend. A successful Supabase login alone will not prove that full-stack account/profile lookup works.
- Missing profiles redirect to `/auth/complete-profile`. Report the unmet fixture, do not complete a profile as verification setup.
- The `Sign in with Google` button is disabled. OAuth is not a supported journey here.
- Signup and password-reset links exist but send/create state; do not follow through without separate approval.
- Successful session, guard, visibility, and persistence checks were not part of the initial landing proof.
