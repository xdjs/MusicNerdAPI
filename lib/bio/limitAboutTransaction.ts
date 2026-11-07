import { sql } from "drizzle-orm";
import type { TransactionDb } from "@/lib/ownership/types";

/** Bound explicit About transactions without changing the shared pool's defaults. */
export async function limitAboutTransaction(tx: Pick<TransactionDb, "execute">): Promise<void> {
  await tx.execute(
    sql`select set_config('lock_timeout','2000',true), set_config('statement_timeout','5000',true)`,
  );
}
