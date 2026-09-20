/**
 * @file api-log.ts
 * @module frontend/lib
 *
 * Logging utilities for backend API requests and responses.
 * Used by both lib/server/api-client.ts (server context) and
 * lib/client/api-client.ts (browser context) to produce consistent
 * console log entries for all backend fetch calls.
 *
 * ## Responsibilities
 * - resolveBackendBaseUrl(value, fallback): treat blank env as missing
 * - buildBackendRequestUrl(baseUrl, path): construct full request URL
 * - logApiRequest(scope, method, url): log outgoing request
 * - logApiResponse(scope, method, url, status, durationMs): log successful response
 * - logApiError(scope, method, url, status, message, durationMs): log error response
 *
 * ## What belongs here
 * - API call logging helpers (pure functions, no side effects beyond console)
 *
 * ## What does NOT belong here
 * - The actual fetch logic (that's in lib/server/api-client.ts or lib/client/api-client.ts)
 * - Business logic or data transformation
 */
type ApiLogScope = "server" | "client";

export const DEFAULT_LOCAL_BACKEND_URL = "http://localhost:3001";

function scopeLabel(scope: ApiLogScope): string {
  return scope === "server" ? "API server→backend" : "API client→backend";
}

/**
 * Treat unset / blank env values as missing so Docker ARG="" does not become
 * an invalid `new URL()` base (Railway frontend image).
 */
export function resolveBackendBaseUrl(
  value: string | undefined | null,
  fallback: string = DEFAULT_LOCAL_BACKEND_URL
): string {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : fallback;
}

/** Join backend base URL and API path into a full request URL. */
export function buildBackendRequestUrl(baseUrl: string, path: string): string {
  const resolved = resolveBackendBaseUrl(baseUrl);
  const base = resolved.endsWith("/") ? resolved : `${resolved}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  try {
    return new URL(normalizedPath, base).href;
  } catch {
    throw new TypeError(
      `Invalid backend base URL ${JSON.stringify(baseUrl)}. Expected an absolute http(s) URL (BACKEND_URL / NEXT_PUBLIC_BACKEND_URL).`
    );
  }
}

/** Log an outgoing backend API request. */
export function logApiRequest(
  scope: ApiLogScope,
  method: string,
  url: string
): void {
  console.log(`[${scopeLabel(scope)}] ${method.toUpperCase()} ${url}`);
}

/** Log a completed backend API response. */
export function logApiResponse(
  scope: ApiLogScope,
  method: string,
  url: string,
  status: number,
  durationMs: number
): void {
  console.log(
    `[${scopeLabel(scope)}] ${method.toUpperCase()} ${url} — ${status} (${durationMs}ms)`
  );
}

/** Log a failed backend API response. */
export function logApiError(
  scope: ApiLogScope,
  method: string,
  url: string,
  status: number,
  message: string,
  durationMs: number
): void {
  console.error(
    `[${scopeLabel(scope)}] ${method.toUpperCase()} ${url} — ${status} (${durationMs}ms): ${message}`
  );
}
