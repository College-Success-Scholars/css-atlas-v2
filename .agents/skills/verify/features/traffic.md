# Traffic kiosk

Visitors enter a nine-digit UID and a planned leave time to record a visit. Invalid UID input should show validation without recording traffic.

## Sub-features

- `traffic-invalid` rejects an empty or invalid UID.
- `traffic-leave-time` exposes leave-hour, leave-minute, and quick-stay choices.
- `traffic-record` writes a valid visit, only with separate authorization.

## How to get to it (user POV)

- Open the public `/traffic` page without signing in.
- Enter a UID, choose a leave time, and choose `Record Traffic`.

## Driving it with agent-browser

Preconditions:

- Use the owned public `serve` instance and doctor from the skill. `AB` means its full named driver invocation.
- Default verification must not enter a valid nine-digit UID or create a visit. A write-enabled journey needs explicit permission and a confirmed isolated database and test UID.

- **Open.** Run `AB open http://127.0.0.1:4310/traffic`, then `AB snapshot`. Require the `Enter 9-digit UID` input and `Record Traffic` button.
- **Reject empty input.** Leave the UID empty and run `AB find role button click --name "Record Traffic" --exact`, then `AB wait --text "UID must be exactly 9 digits"` and `AB snapshot`. Require the validation message and focus on the UID input. Capture the action, resulting snapshot, and browser/server errors. Do not claim a successful check-in.
- **Inspect time controls.** Use a fresh snapshot to identify `Leave hour`, `Leave minute`, and `Type leave time`. Exercise selection only if it can be done without submitting. Record visible time changes and keep the UID invalid.
- **Approved recording only.** On the explicitly approved isolated target, enter its approved test UID and a future leave time through these controls. Choose `Record Traffic`, capture success before the roughly 1.5-second reset, and verify the inserted visit with an authorized read-only observation of `traffic`. Record the exact created row ID privately. Arrange separately authorized cleanup, never bulk delete.

## Gotchas

- Valid submission directly inserts into Supabase through a Next server action. It does not go through Express. An absent backend does not make valid kiosk submissions safe.
- A developer persona's backend write restrictions do not protect this path.
- Missing fixtures or database access block `traffic-record`. Invalid-input validation is a separate check, not an acceptable replacement for a requested successful visit.
- Initial skill proof exercised landing-to-login only. Traffic validation and recording remain unverified.
