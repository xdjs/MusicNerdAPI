import { vaultSourceRevision } from "@/lib/lore/vaultSourceRevision";
import { isCitableSource } from "@/lib/sources/isCitableSource";
import { queueApprovedSourceExtraction } from "@/lib/sourceExtraction/queueApprovedSourceExtraction";
import { and, ne, sql } from "drizzle-orm";
import { recordArtistActivity } from "@/lib/activity/recordArtistActivity";
import { artistVaultSources } from "@/lib/db/schema";
import type { VaultSource } from "@/lib/vault/types";
import { withVaultSourceWrite } from "@/lib/vault/withVaultSourceWrite";

/**
 * Changes a vault source's decision and records activity once,
 * in one transaction.
 *
 * @param sourceId - The source.
 * @param status - The decision.
 * @returns The updated source, or undefined when nothing matched. A failed write throws.
 */
export async function updateVaultSourceStatus(
  sourceId: string,
  status: "approved" | "rejected",
  expectedResearch?: VaultSource,
): Promise<VaultSource | undefined> {
  try {
    return await withVaultSourceWrite(sourceId, async (tx, predicate) => {
      if (expectedResearch) {
        const [current] = await tx.select().from(artistVaultSources).where(predicate).for("update");
        if (
          status !== "approved" ||
          !current ||
          current.artistId !== expectedResearch.artistId ||
          current.status !== "pending" ||
          expectedResearch.status !== "pending" ||
          current.origin !== "research" ||
          !current.activityId ||
          current.publication === "private" ||
          !isCitableSource(current) ||
          current.updatedAt !== expectedResearch.updatedAt ||
          vaultSourceRevision(current) !== vaultSourceRevision(expectedResearch)
        )
          return undefined;
      }
      const [row] = await tx
        .update(artistVaultSources)
        .set({ status, updatedAt: sql`(now() AT TIME ZONE 'utc'::text)` })
        .where(and(predicate, ne(artistVaultSources.status, status)))
        .returning();
      if (row) {
        const activityId = await recordArtistActivity(
          row.artistId,
          `source_${status}`,
          { sourceId },
          tx,
        );
        await queueApprovedSourceExtraction(tx, row, activityId);
      }
      return row;
    });
  } catch (e) {
    console.error("[updateVaultSourceStatus] Error:", e);
    throw e;
  }
}
