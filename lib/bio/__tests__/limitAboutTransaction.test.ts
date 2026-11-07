import { expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { limitAboutTransaction } from "../limitAboutTransaction";
it("sets transaction-local lock and statement limits rather than changing shared connection defaults", async () => {
  const execute = vi.fn().mockResolvedValue([]);
  await limitAboutTransaction({ execute } as never);
  const query = new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
  expect(query.sql).toContain("set_config('lock_timeout'");
  expect(query.sql).toContain("set_config('statement_timeout'");
  expect(query.sql).toContain("true");
  expect(query.sql).toContain("2000");
  expect(query.sql).toContain("5000");
});
