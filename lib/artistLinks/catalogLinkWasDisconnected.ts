import { sql } from "drizzle-orm";
import { rowsOf } from "@/lib/db/rowsOf";
import type { TransactionDb } from "@/lib/ownership/types";

/** Check only the private archive's boolean guard; missing migration/permission fails closed. */
export async function catalogLinkWasDisconnected(
  transaction: Pick<TransactionDb, "execute">,
  artistId: string,
  platform: string,
): Promise<boolean> {
  const [row] = rowsOf(
    await transaction.execute(sql`
    SELECT musicnerd_private.catalog_link_was_disconnected(${artistId}::uuid, ${platform}) AS blocked
  `),
  ) as { blocked?: boolean }[];
  if (typeof row?.blocked !== "boolean") throw new Error("Catalog disconnect guard unavailable");
  return row.blocked;
}
