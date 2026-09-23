import { describe, expect, it } from "vitest";
import { decideSigninAction } from "../domains/notifications/detectors/signin-detector.js";

describe("decideSigninAction", () => {
  const start = Date.UTC(2026, 8, 23, 18, 0);
  const late = start + 15 * 60_000;
  const end = start + 60 * 60_000;

  it.each([
    [late - 60_000, { action: "skip", reason: "before_late_threshold" }], [late, { action: "emit", phase: "late" }],
    [end - 60_000, { action: "emit", phase: "late" }], [end, { action: "emit", phase: "ended" }],
    [end + 60 * 60_000, { action: "emit", phase: "ended" }], [end + 60 * 60_000 + 1, { action: "skip", reason: "stale_after_end" }],
  ])("selects the correct action at %i", (now, expected) => expect(decideSigninAction(now, late, end, 60)).toEqual(expected));
});
