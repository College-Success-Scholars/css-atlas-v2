/**
 * @file memo.service.ts
 * @module backend/services
 *
 * Memo supporting operations that are not page-data assembly.
 * Session-record sync is retired — attendance is computed on read.
 *
 * ## Responsibilities
 * - Documented no-op for POST /api/memo/sync
 *
 * ## What does NOT belong here
 * - Memo page data assembly (that's memo-page.service.ts)
 * - HTTP request/response logic
 */

/** Retired: Memo attendance no longer depends on *_records upserts. */
export async function syncMemo(
  weekNum: number,
  mode: "light" | "heavy"
): Promise<{
  mode: string;
  fd: { upserted: number };
  ss: { upserted: number };
  message: string;
}> {
  return {
    mode,
    fd: { upserted: 0 },
    ss: { upserted: 0 },
    message: `Session-record sync is retired. Memo attendance is computed on read from tickets + scholar_week_excuses (week ${weekNum}).`,
  };
}
