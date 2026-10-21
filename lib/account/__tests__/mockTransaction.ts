import { vi } from "vitest";
import { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";

/** One statement the mocked transaction received, in order. */
export interface LoggedStatement {
  kind: string;
  text?: string;
  params?: unknown[];
  values?: Record<string, unknown>;
  rows?: unknown[];
}

function renderValues(values: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      value instanceof SQL ? renderSql(value) : value,
    ]),
  );
}

/**
 * A drizzle transaction double that records every statement it receives, in
 * order, with its rendered SQL and parameters. Each `select` or `findFirst`
 * takes the next entry of `results` as its rows.
 *
 * @param results - The rows each read returns, in call order.
 * @returns The transaction and its statement log.
 */
export function mockTransaction(results: unknown[][] = []) {
  const log: LoggedStatement[] = [];
  const nextRows = () => results.shift() ?? [];
  const select = vi.fn(() => {
    const rows = nextRows();
    const entry: LoggedStatement = { kind: "select", rows };
    log.push(entry);
    const query = {
      from: vi.fn(() => query),
      innerJoin: vi.fn(() => query),
      where: vi.fn((condition: SQL) => {
        Object.assign(entry, renderSql(condition));
        return query;
      }),
      orderBy: vi.fn(() => query),
      for: vi.fn((mode: string) => {
        entry.kind = `select for ${mode}`;
        return Promise.resolve(rows);
      }),
      then: (resolve: (rows: unknown[]) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(rows).then(resolve, reject),
    };
    return query;
  });
  const tx = {
    select,
    execute: vi.fn(async (query: SQL) => {
      log.push({ kind: "execute", ...renderSql(query) });
      return [];
    }),
    insert: vi.fn(() => ({
      values: (rows: unknown[]) => {
        const entry: LoggedStatement = { kind: "insert", rows };
        log.push(entry);
        return {
          onConflictDoNothing: vi.fn(async () => {
            entry.kind = "insert on conflict do nothing";
          }),
          onConflictDoUpdate: vi.fn(async (conflict: { set: Record<string, unknown> }) => {
            entry.kind = "insert on conflict do update";
            entry.values = conflict.set;
          }),
        };
      },
    })),
    update: vi.fn(() => ({
      set: (values: Record<string, unknown>) => ({
        where: async (condition: SQL) => {
          log.push({ kind: "update", values: renderValues(values), ...renderSql(condition) });
        },
      }),
    })),
    delete: vi.fn(() => ({
      where: async (condition: SQL) => {
        log.push({ kind: "delete", ...renderSql(condition) });
      },
    })),
    query: {
      users: {
        findFirst: vi.fn(async ({ where }: { where: SQL }) => {
          const rows = nextRows();
          log.push({ kind: "findFirst", ...renderSql(where), rows });
          return rows[0];
        }),
      },
    },
  };
  return { tx, log };
}
