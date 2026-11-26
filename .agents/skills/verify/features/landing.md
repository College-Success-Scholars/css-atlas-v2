# Landing-to-login

Visitors see CSS Atlas's public introduction and reach the login form through its Sign in link.

## Sub-features

- `landing-render` shows the introduction and marketing heading without an account.
- `landing-sign-in` follows the hero link to the login form.

## How to get to it (user POV)

- Open `/` in a browser without Atlas cookies.
- Choose `Sign in` in the `Introduction` region.

## Driving it with agent-browser

Preconditions:

- Launch and doctor succeed using the verify skill's public instance.
- The named browser has no restored account. Use the full `AB` invocation defined in the skill.

- **Open.** Run `AB open http://127.0.0.1:4310/`, then `AB wait --text "Your engagement, one clear view"` and `AB snapshot`. Require region `Introduction`, the H1, and link `Sign in`. Capture `landing.aria.txt` and `landing.png` before acting.
- **Follow the user path.** Run `AB find role link click --name "Sign in" --exact`. If another matching link is introduced, scope a fresh snapshot to the `Introduction` region and choose its current ref.
- **Confirm.** Run `AB wait --url "**/auth/login"`, `AB wait --text "Login to CSS Atlas"`, and `AB snapshot`. Require labeled controls `Email`, `Password`, `Remember me`, and button `Sign In`. Capture `login.aria.txt` and `login.png` after the action.
- **Record proof.** Run `AB errors`. Save actions and errors alongside the before/after artifacts. `control.py smoke` performs these steps automatically and records each CLI exit code.

## Gotchas

- Signed-in users may be redirected to `/dashboard`; that is not the public baseline.
- Going directly to `/auth/login` does not prove the hero link works.
- Public pages still run middleware requiring validly configured public Supabase client variables.
- This check does not submit credentials or prove backend/database readiness.
