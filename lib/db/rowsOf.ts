/**
 * Rows out of a `db.execute` result, whatever shape the driver hands back.
 * A result with no rows means the query ran and matched nothing, which is an
 * answer; only a thrown error means we could not ask. The identity guards fail
 * closed on the second, so the two must stay distinguishable.
 *
 * @param result - What `db.execute` returned.
 * @returns The rows, or [] when there are none.
 */
export function rowsOf(result: unknown): unknown[] {
  if (!result) return [];
  const r = result as { rows?: unknown[] };
  if (Array.isArray(r.rows)) return r.rows;
  return Array.isArray(result) ? result : [];
}
