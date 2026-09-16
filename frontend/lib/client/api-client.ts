/**
 * @file api-client.ts
 * @module frontend/lib/client
 *
 * Browser-side HTTP client for calling the Express backend API from Client Components.
 * Reads the current Supabase session token using the browser Supabase client
 * and attaches it as Authorization: Bearer to backend requests.
 * Automatically unwraps the { data: ... } envelope that all backend routes return.
 *
 * ## Responsibilities
 * - getAccessToken(): get JWT from browser Supabase session
 * - backendFetch<T>(path, options): authenticated browser fetch to backend
 * - backendGet<T>(path): GET shorthand
 * - backendPost<T>(path, body): POST shorthand
 * - backendPatch<T>(path, body): PATCH shorthand
 *
 * ## What belongs here
 * - Client-side authenticated fetch to the backend
 *
 * ## What does NOT belong here
 * - Server-side fetch (that's lib/server/api-client.ts)
 * - import "server-only" — this runs in the browser
 * - next/headers or cookies() — those are server-only APIs
 */
"use client";

import { createClient } from "@/lib/supabase/client";
import {
  buildBackendRequestUrl,
  logApiError,
  logApiRequest,
  logApiResponse,
  resolveBackendBaseUrl,
} from "@/lib/api-log";

const BACKEND_URL = resolveBackendBaseUrl(process.env.NEXT_PUBLIC_BACKEND_URL);

async function getAccessToken(): Promise<string | null> {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

export async function backendFetch<T>(
  path: string,
  options?: { method?: string; body?: unknown }
): Promise<{ data: T; ok: true } | { error: string; ok: false; status: number }> {
  const method = options?.method ?? "GET";
  const requestUrl = buildBackendRequestUrl(BACKEND_URL, path);
  const start = Date.now();
  logApiRequest("client", method, requestUrl);

  const token = await getAccessToken();
  const res = await fetch(requestUrl, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(options?.body !== undefined
      ? { body: JSON.stringify(options.body) }
      : {}),
  });
  const durationMs = Date.now() - start;
  const json = await res.json().catch(() => ({ error: res.statusText }));

  if (!res.ok) {
    const error =
      (json as { error?: string }).error ?? `Backend error: ${res.status}`;
    logApiError("client", method, requestUrl, res.status, error, durationMs);
    return {
      error,
      ok: false,
      status: res.status,
    };
  }

  logApiResponse("client", method, requestUrl, res.status, durationMs);
  // Unwrap { data: ... } — returns { ok, data } | { ok: false, error, status } (unlike server client which throws)
  const payload = json != null && typeof json === "object" && "data" in json ? json.data : json;
  return { data: payload as T, ok: true };
}

export async function backendGet<T>(path: string) {
  return backendFetch<T>(path);
}

export async function backendPost<T>(path: string, body: unknown) {
  return backendFetch<T>(path, { method: "POST", body });
}

export async function backendPatch<T>(path: string, body: unknown) {
  return backendFetch<T>(path, { method: "PATCH", body });
}
