/**
 * @file request-validation.ts
 * @module backend/utils
 *
 * Generic request-body/query parsing helpers with nothing auth-specific
 * about them — shared across controllers instead of each one reinventing
 * its own validation.
 */

type CreateProfileBody = {
  first_name?: unknown;
  last_name?: unknown;
  student_id?: unknown;
  phone_number?: unknown;
  cohort?: unknown;
};

export function parseCreateProfileBody(body: unknown): {
  first_name: string;
  last_name: string;
  student_id: string;
  phone_number: string | null;
  cohort: number;
} | null {
  if (body == null || typeof body !== "object") return null;
  const b = body as CreateProfileBody;
  const first_name = typeof b.first_name === "string" ? b.first_name.trim() : "";
  const last_name = typeof b.last_name === "string" ? b.last_name.trim() : "";
  const studentIdNum =
    typeof b.student_id === "number"
      ? b.student_id
      : typeof b.student_id === "string"
        ? Number.parseInt(b.student_id.trim(), 10)
        : NaN;
  const phone_number =
    b.phone_number == null || b.phone_number === ""
      ? null
      : typeof b.phone_number === "string"
        ? b.phone_number.trim()
        : null;
  const cohort =
    typeof b.cohort === "number"
      ? b.cohort
      : typeof b.cohort === "string"
        ? Number.parseInt(b.cohort, 10)
        : NaN;

  if (
    !first_name ||
    !last_name ||
    !Number.isFinite(studentIdNum) ||
    studentIdNum < 1 ||
    !Number.isFinite(cohort) ||
    cohort < 1
  ) {
    return null;
  }

  return { first_name, last_name, student_id: String(studentIdNum), phone_number, cohort };
}

/** Widest allowed span for a startDate/endDate query, in days. */
export const MAX_DATE_RANGE_DAYS = 90;

type DateRangeQuery = {
  startDate?: unknown;
  endDate?: unknown;
};

/**
 * Parses `?startDate=<ISO>&endDate=<ISO>` into Dates, rejecting anything
 * that isn't a valid ISO string, an inverted range, or a span wider than
 * MAX_DATE_RANGE_DAYS.
 */
export function parseDateRangeQuery(query: unknown): { startDate: Date; endDate: Date } | null {
  if (query == null || typeof query !== "object") return null;
  const q = query as DateRangeQuery;
  const startDate = typeof q.startDate === "string" ? new Date(q.startDate) : null;
  const endDate = typeof q.endDate === "string" ? new Date(q.endDate) : null;

  if (!startDate || !endDate || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }
  if (startDate.getTime() > endDate.getTime()) return null;

  const rangeMs = endDate.getTime() - startDate.getTime();
  const maxRangeMs = MAX_DATE_RANGE_DAYS * 24 * 60 * 60 * 1000;
  if (rangeMs > maxRangeMs) return null;

  return { startDate, endDate };
}
