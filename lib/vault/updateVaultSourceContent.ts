import { sql } from "drizzle-orm";
import { artistVaultSources } from "@/lib/db/schema";
import type { VaultSource, VaultSourceContent } from "@/lib/vault/types";
import { withVaultSourceWrite } from "@/lib/vault/withVaultSourceWrite";

/**
 * Fills in what was read from a source's page. Only the fields given are set.
 *
 * @param sourceId - The source.
 * @param data - The page's title, snippet, text, image, podcast identity and date.
 * @returns The updated source, or undefined when nothing matched. A failed write throws.
 */
export async function updateVaultSourceContent(
  sourceId: string,
  data: VaultSourceContent,
): Promise<VaultSource | undefined> {
  const fields = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
  try {
    const [updated] = await withVaultSourceWrite(sourceId, (tx, predicate) =>
      tx
        .update(artistVaultSources)
        .set({ ...fields, updatedAt: sql`(now() AT TIME ZONE 'utc'::text)` })
        .where(predicate)
        .returning(),
    );
    return updated;
  } catch (e) {
    console.error("[updateVaultSourceContent] Error:", e);
    throw e;
  }
}
