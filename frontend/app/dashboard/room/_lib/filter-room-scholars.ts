export function filterRoomScholarsByName<T extends { scholarName: string | null }>(
  scholars: T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return scholars
  return scholars.filter((s) => (s.scholarName ?? "").toLowerCase().includes(q))
}
