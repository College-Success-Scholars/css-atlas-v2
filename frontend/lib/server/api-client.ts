/**
 * @file api-client.ts
 * @module frontend/lib/server
 *
 * Server-only HTTP client for calling the Express backend API.
 * Reads the Supabase JWT from auth cookies, attaches it as an Authorization
 * header, and fetches the requested backend endpoint. Automatically unwraps
 * the { data: ... } envelope that all backend routes return.
 *
 * ## Responsibilities
 * - getAccessToken(): extract JWT from @supabase/ssr chunked auth cookies
 * - backendFetch<T>(path, options): authenticated fetch to backend, unwraps data
 * - backendGet<T>(path): GET shorthand
 * - backendPost<T>(path, body): POST shorthand
 * - backendPatch<T>(path, body): PATCH shorthand
 *
 * ## What belongs here
 * - The low-level server-side authenticated fetch infrastructure
 *
 * ## What does NOT belong here
 * - Typed endpoint wrappers (those go in lib/server/data.ts)
 * - Client-side fetch logic (that's lib/client/api-client.ts)
 * - Business logic or data transformation
 */
import "server-only";
import { cookies } from "next/headers";
import {
  buildBackendRequestUrl,
  DEFAULT_LOCAL_BACKEND_URL,
  logApiError,
  logApiRequest,
  logApiResponse,
  resolveBackendBaseUrl,
} from "@/lib/api-log";
import {
  DEV_ACTIVE_PROFILE_COOKIE,
  DEV_ACTIVE_PROFILE_HEADER,
} from "../../../shared/dist/auth.js";

const BACKEND_URL = resolveBackendBaseUrl(
  process.env.BACKEND_URL,
  process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}/_/backend`
    : DEFAULT_LOCAL_BACKEND_URL
);
const BASE64_PREFIX = "base64-";

function getSupabaseProjectRef(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname;
    const ref = hostname.split(".")[0];
    return ref || null;
  } catch {
    return null;
  }
}

function getCookieChunkIndex(name: string): number {
  const match = name.match(/\.([0-9]+)$/);
  if (!match) return 0;
  return Number.parseInt(match[1], 10);
}

/**
 * Decode a base64url string (no padding) to a UTF-8 string.
 */
function base64UrlDecode(str: string): string {
  // Convert base64url to standard base64
  let b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  // Add padding
  while (b64.length % 4 !== 0) b64 += "=";
  return Buffer.from(b64, "base64").toString("utf-8");
}

/**
 * Extract the Supabase access token from auth cookies.
 * @supabase/ssr v0.7 stores cookies as "base64-<base64url(json)>",
 * possibly chunked across sb-<ref>-auth-token.0, .1, etc.
 */
async function getAccessToken(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    const projectRef = getSupabaseProjectRef();

    // Find Supabase auth token cookies.
    const authCandidates = allCookies
      .filter((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Select only one cookie family to avoid combining multiple Supabase projects.
    const preferredBase = projectRef ? `sb-${projectRef}-auth-token` : null;
    let authParts = authCandidates;
    if (preferredBase) {
      const matching = authCandidates.filter(
        (c) => c.name === preferredBase || c.name.startsWith(`${preferredBase}.`)
      );
      if (matching.length > 0) {
        authParts = matching;
      }
    }
    authParts = authParts.sort((a, b) => getCookieChunkIndex(a.name) - getCookieChunkIndex(b.name));

    if (authParts.length === 0) return null;

    const raw = authParts.map((c) => c.value).join("");

    // Decode: strip "base64-" prefix, then base64url-decode
    let decoded: string;
    if (raw.startsWith(BASE64_PREFIX)) {
      decoded = base64UrlDecode(raw.substring(BASE64_PREFIX.length));
    } else {
      decoded = raw;
    }

    const session = JSON.parse(decoded);
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

export async function backendFetch<T>(
  path: string,
  options?: { method?: string; body?: unknown }
): Promise<T> {
  const method = options?.method ?? "GET";
  const requestUrl = buildBackendRequestUrl(BACKEND_URL, path);
  const start = Date.now();
  logApiRequest("server", method, requestUrl);

  const token = await getAccessToken();
  const cookieStore = await cookies();
  const devActiveProfile = cookieStore.get(DEV_ACTIVE_PROFILE_COOKIE)?.value ?? null;
  const res = await fetch(requestUrl, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(devActiveProfile ? { [DEV_ACTIVE_PROFILE_HEADER]: devActiveProfile } : {}),
    },
    ...(options?.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    cache: "no-store",
  });
  const durationMs = Date.now() - start;

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const message = (err as { error?: string }).error ?? `Backend error: ${res.status}`;
    logApiError("server", method, requestUrl, res.status, message, durationMs);
    throw new Error(message);
  }

  logApiResponse("server", method, requestUrl, res.status, durationMs);
  const json = await res.json();
  // Unwrap { data: ... } — most routes; exceptions: GET /api/auth/me returns { user, profile }
  if (json != null && typeof json === "object" && "data" in json) {
    return json.data as T;
  }
  return json as T;
}

export async function backendGet<T>(path: string): Promise<T> {
  return backendFetch<T>(path);
}

export async function backendPost<T>(path: string, body: unknown): Promise<T> {
  return backendFetch<T>(path, { method: "POST", body });
}

export async function backendPatch<T>(path: string, body: unknown): Promise<T> {
  return backendFetch<T>(path, { method: "PATCH", body });
}
