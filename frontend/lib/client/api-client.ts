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
 * - callEndpoint(contract, request): typed call to a contract-backed endpoint (preferred)
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
  endpointPath,
  type Endpoint,
  type EndpointOutput,
  type EndpointRequest,
} from "@css-atlas/shared/contract";
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

async function backendFetch<T>(
  path: string,
  options?: { method?: string; body?: unknown }
): Promise<{ data: T; ok: true } | { error: string; ok: false; status: number }> {
  const method = options?.method ?? "GET";
  const start = Date.now();

  let requestUrl: string;
  try {
    requestUrl = buildBackendRequestUrl(BACKEND_URL, path);
  } catch (e) {
    const error = e instanceof Error ? e.message : "Invalid backend URL";
    logApiError("client", method, path, 0, error, Date.now() - start);
    return { error, ok: false, status: 0 };
  }
  logApiRequest("client", method, requestUrl);

  // A thrown fetch (network failure, CORS rejection, DNS/connection error) must still
  // resolve to { ok: false } — callers rely on this never rejecting to clear loading state.
  try {
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
  } catch (e) {
    const durationMs = Date.now() - start;
    const error = e instanceof Error ? e.message : "Network request failed";
    logApiError("client", method, requestUrl, 0, error, durationMs);
    return { error, ok: false, status: 0 };
  }
}

/** The request a caller sends to a contract; omittable when every part is empty. */
type RequestArgs<E extends Endpoint> =
  Record<string, never> extends EndpointRequest<E> ? [request?: EndpointRequest<E>] : [request: EndpointRequest<E>];

/**
 * Call a contract-backed endpoint from a Client Component. Path, method,
 * request shape and result type all come from the contract. Never rejects:
 * resolves to `{ ok: false, error, status }` on any failure.
 */
export async function callEndpoint<E extends Endpoint>(contract: E, ...[request]: RequestArgs<E>) {
  const { params, query, body } = (request ?? {}) as { params?: unknown; query?: unknown; body?: unknown };
  return backendFetch<EndpointOutput<E>>(endpointPath(contract, { params, query }), {
    method: contract.method,
    ...(contract.method === "GET" ? {} : { body: body ?? {} }),
  });
}

