/**
 * @file client.ts
 * @module backend/supabase
 *
 * Supabase client factory with per-request JWT binding via AsyncLocalStorage.
 * Typed against generated `Database` (Postgres public schema). Domain services
 * call getSupabaseClient(); do not put domain logic here.
 *
 * Regenerate schema types (from repo root, linked project):
 *   supabase gen types typescript --linked --schema public > backend/src/supabase/database.types.ts
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types.js";

export type AppSupabaseClient = SupabaseClient<Database>;
export type ServiceSupabaseClient = SupabaseClient;

let authClient: AppSupabaseClient | null = null;

/** Stores the current request's JWT so services can create user-scoped clients. */
const tokenStore = new AsyncLocalStorage<string>();

/** Run a callback with the user's JWT available to getSupabaseClient(). */
export function runWithToken<T>(token: string, fn: () => T): T {
  return tokenStore.run(token, fn);
}

/**
 * Per-request client using publishable key + user JWT.
 * RLS is applied based on the user's token.
 */
export function getSupabaseClient(): AppSupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY env vars");
  }
  const token = tokenStore.getStore();
  if (!token) {
    throw new Error("No user token in context — ensure request passes through auth middleware");
  }
  return createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

/** Publishable key client (no user context) — use only for auth.getUser() token verification. */
export function getSupabaseAuthClient(): AppSupabaseClient {
  if (authClient) return authClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY env vars");
  }
  authClient = createClient<Database>(url, key);
  return authClient;
}

/** Service-role client for isolated cron jobs that must bypass user-scoped RLS. */
export function getSupabaseServiceRoleClient(): ServiceSupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
