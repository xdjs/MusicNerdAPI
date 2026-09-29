import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const dialect = new PgDialect();

/**
 * Renders a drizzle `sql` fragment the way Postgres will receive it, so tests
 * can check clauses and parameters instead of object internals.
 *
 * @param query - The fragment passed to `db.execute`.
 * @returns The SQL text with whitespace collapsed, and its parameters.
 */
export function renderSql(query: SQL): { text: string; params: unknown[] } {
  const { sql, params } = dialect.sqlToQuery(query);
  return { text: sql.replace(/\s+/g, " ").trim(), params };
}
