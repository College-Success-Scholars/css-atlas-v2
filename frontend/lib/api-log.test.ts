import { describe, expect, it } from "vitest";
import {
  buildBackendRequestUrl,
  DEFAULT_LOCAL_BACKEND_URL,
  resolveBackendBaseUrl,
} from "./api-log";

describe("resolveBackendBaseUrl", () => {
  it("falls back when the value is missing or blank", () => {
    expect(resolveBackendBaseUrl(undefined)).toBe(DEFAULT_LOCAL_BACKEND_URL);
    expect(resolveBackendBaseUrl(null)).toBe(DEFAULT_LOCAL_BACKEND_URL);
    expect(resolveBackendBaseUrl("")).toBe(DEFAULT_LOCAL_BACKEND_URL);
    expect(resolveBackendBaseUrl("   ")).toBe(DEFAULT_LOCAL_BACKEND_URL);
  });

  it("keeps a trimmed non-empty value", () => {
    expect(resolveBackendBaseUrl(" https://api.example.com ")).toBe(
      "https://api.example.com"
    );
  });
});

describe("buildBackendRequestUrl", () => {
  it("joins a valid absolute base with an API path", () => {
    expect(
      buildBackendRequestUrl(
        "https://api.example.com",
        "/api/attendance/week/1?kind=front_desk"
      )
    ).toBe("https://api.example.com/api/attendance/week/1?kind=front_desk");
  });

  it("does not throw when the base is empty (Railway Docker ARG)", () => {
    expect(buildBackendRequestUrl("", "/api/attendance/week/1")).toBe(
      `${DEFAULT_LOCAL_BACKEND_URL}/api/attendance/week/1`
    );
  });

  it("throws a clear error for a relative base URL", () => {
    expect(() => buildBackendRequestUrl("/_/backend", "/api/auth/me")).toThrow(
      /Invalid backend base URL/
    );
  });
});
