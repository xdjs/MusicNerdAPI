import { sql } from "drizzle-orm";
import type { TransactionDb } from "@/lib/ownership/types";

/** Opt this publishing transaction into the current writer contract; never marks a pooled session. */
export async function markAboutWriter(tx: Pick<TransactionDb, "execute">): Promise<void> {
  await tx.execute(sql`select set_config('musicnerd.about_writer_version','1655-v1',true)`);
}
