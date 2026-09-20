/**
 * @file supabase-errors.ts
 * @module backend/utils
 *
 * Generic PostgREST/Postgres error formatting, shared by every controller
 * that lets a Supabase error reach the global error handler (see app.ts)
 * instead of formatting it locally. Centralizing this is what lets us
 * decide, in one place, how much of a Postgres error (message vs. hint vs.
 * code) is safe to expose to a client — full detail for a 4xx caused by the
 * client's own input, a generic message for a 5xx that might leak schema
 * or query internals.
 */

export function supabaseErrorStatus(error: unknown): number {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code?: string }).code ?? "");
    // PostgREST data/format errors (e.g. invalid type, unknown column)
    if (code.startsWith("22") || code.startsWith("23") || code === "PGRST204") {
      return 400;
    }
  }
  return 500;
}

export function formatSupabaseError(error: unknown, status: number): string {
  if (status >= 500) return "Internal server error";

  if (error && typeof error === "object" && "message" in error) {
    const e = error as { message?: string; details?: string; hint?: string; code?: string };
    const parts = [e.message, e.details, e.hint, e.code ? `(${e.code})` : ""].filter(Boolean);
    if (parts.length > 0) return parts.join(" — ");
  }
  if (error instanceof Error) return error.message;
  return "Request failed";
}
