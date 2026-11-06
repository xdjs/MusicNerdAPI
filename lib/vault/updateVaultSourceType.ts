import { sql } from "drizzle-orm";
import { artistVaultSources } from "@/lib/db/schema";
import type { VaultSource } from "@/lib/vault/types";
import { withVaultSourceWrite } from "@/lib/vault/withVaultSourceWrite";

/**
 * Changes a vault source's type.
 *
 * @param sourceId - The source.
 * @param type - The new type.
 * @returns The updated source, or undefined when nothing matched. A failed write throws.
 */
export async function updateVaultSourceType(
  sourceId: string,
  type: string,
): Promise<VaultSource | undefined> {
  try {
    const [updated] = await withVaultSourceWrite(sourceId, (tx, predicate) =>
      tx
        .update(artistVaultSources)
        .set({ type, updatedAt: sql`(now() AT TIME ZONE 'utc'::text)` })
        .where(predicate)
        .returning(),
    );
    return updated;
  } catch (e) {
    console.error("[updateVaultSourceType] Error:", e);
    throw e;
  }
}
