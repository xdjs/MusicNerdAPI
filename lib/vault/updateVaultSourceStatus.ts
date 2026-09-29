import { sql } from "drizzle-orm";
import { recordArtistActivity } from "@/lib/activity/recordArtistActivity";
import { artistVaultSources } from "@/lib/db/schema";
import type { VaultSource } from "@/lib/vault/types";
import { withVaultSourceWrite } from "@/lib/vault/withVaultSourceWrite";

/**
 * Approves or rejects a vault source and records the decision as activity,
 * in one transaction.
 *
 * @param sourceId - The source.
 * @param status - The decision.
 * @returns The updated source, or undefined when nothing matched. A failed write throws.
 */
export async function updateVaultSourceStatus(
  sourceId: string,
  status: "approved" | "rejected",
): Promise<VaultSource | undefined> {
  try {
    return await withVaultSourceWrite(sourceId, async (tx, predicate) => {
      const [row] = await tx
        .update(artistVaultSources)
        .set({ status, updatedAt: sql`(now() AT TIME ZONE 'utc'::text)` })
        .where(predicate)
        .returning();
      if (row) await recordArtistActivity(row.artistId, `source_${status}`, { sourceId }, tx);
      return row;
    });
  } catch (e) {
    console.error("[updateVaultSourceStatus] Error:", e);
    throw e;
  }
}
