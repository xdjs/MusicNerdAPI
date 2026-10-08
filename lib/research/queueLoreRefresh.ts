import { db } from "@/lib/db/db";
import type { TransactionDb } from "@/lib/ownership/types";
import { queueLoreRefreshInTransaction } from "./queueLoreRefreshInTransaction";

/** Queue a claim-checked Lore refresh, optionally within an existing transaction. */
export async function queueLoreRefresh(
  artistId: string,
  expectedClaimId: string | null,
  opts?: { manual?: boolean },
  writer?: TransactionDb,
): Promise<boolean> {
  if (writer) return queueLoreRefreshInTransaction(writer, artistId, expectedClaimId, opts);
  return db.transaction(tx => queueLoreRefreshInTransaction(tx, artistId, expectedClaimId, opts));
}
