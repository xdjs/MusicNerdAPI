import { AsyncLocalStorage } from "node:async_hooks";
import type { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/lib/db/schema";
import { createHostedAboutAdapter } from "../hosted-about/createHostedAboutAdapter";
export type Database = ReturnType<typeof drizzle<typeof schema>>;
export type Adapter = ReturnType<typeof createHostedAboutAdapter>;
type Scope = { database: Database; adapter: Adapter; closed: boolean };
const scopes = new AsyncLocalStorage<Scope>();
export function currentScope() {
  const scope = scopes.getStore();
  if (!scope || scope.closed) throw new Error("Synthetic database outside request scope");
  return scope;
}
export const db = new Proxy({} as Database, {
  get(_target, key) {
    const database = currentScope().database;
    const value = Reflect.get(database, key);
    return typeof value === "function" ? value.bind(database) : value;
  },
});
export type WriteDb = Pick<Database, "insert" | "delete" | "execute">;
export async function withSyntheticDatabase<T>(
  pg: PGlite,
  adapter: Adapter,
  run: () => Promise<T>,
): Promise<T> {
  const scope: Scope = { database: drizzle(pg, { schema }), adapter, closed: false };
  try {
    return await scopes.run(scope, run);
  } finally {
    scope.closed = true;
    await pg.close();
  }
}
