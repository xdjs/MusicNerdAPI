import { vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";

/**
 * A transaction double for raw-SQL modules: each `execute` returns the next
 * queued result set (empty once they run out), and the rendered statements
 * are kept in order so tests can check what ran and in which sequence.
 *
 * @param results - The rows each successive `execute` returns.
 * @returns The double, its `statements()` and the `update` chain's spies.
 */
export function fakeTransaction(results: unknown[][] = []) {
  const queue = [...results];
  const where = vi.fn(async (_condition: unknown) => {});
  const set = vi.fn(() => ({ where }));
  const execute = vi.fn(async (_q: SQL) => queue.shift() ?? []);
  return {
    execute,
    update: vi.fn(() => ({ set })),
    insert: vi.fn(),
    query: {},
    set,
    where,
    statements: () => execute.mock.calls.map(([q]) => renderSql(q)),
  };
}
