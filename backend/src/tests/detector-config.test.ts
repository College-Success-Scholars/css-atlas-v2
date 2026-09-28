import { describe, expect, it } from "vitest";
import { parseNonNegativeInt } from "../domains/notifications/detectors/detector-data.js";

describe("parseNonNegativeInt", () => {
  it.each([[undefined, 15], ["", 15], ["15min", 15], ["-5", 15], ["0", 0], ["25", 25]])(
    "%s resolves to %i", (raw, expected) => expect(parseNonNegativeInt(raw as string | undefined, 15)).toBe(expected)
  );
});
