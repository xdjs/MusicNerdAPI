import { db } from "@/lib/db/db";
import { queueLoreRefreshInTransaction } from "./queueLoreRefreshInTransaction";
/** Claim-checked durable Lore refresh; a live worker records a follow-on request. */
export async function queueLoreRefresh(
  artistId: string,
  expectedClaimId: string | null,
  opts?: { manual?: boolean },
): Promise<boolean> {
  return db.transaction(tx => queueLoreRefreshInTransaction(tx, artistId, expectedClaimId, opts));
}
