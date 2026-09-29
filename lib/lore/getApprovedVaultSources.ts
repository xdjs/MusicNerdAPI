import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artistVaultSources } from "@/lib/db/schema";
import type { VaultSourceRow } from "@/lib/lore/types";

/**
 * The artist's approved Lore sources, newest first.
 *
 * @param artistId - The artist.
 * @returns The sources; [] on a database error, as in MusicNerdWeb.
 */
export async function getApprovedVaultSources(artistId: string): Promise<VaultSourceRow[]> {
  try {
    return await db.query.artistVaultSources.findMany({
      where: and(
        eq(artistVaultSources.artistId, artistId),
        eq(artistVaultSources.status, "approved"),
      ),
      orderBy: [desc(artistVaultSources.createdAt)],
    });
  } catch (e) {
    console.error("[getApprovedVaultSources] Error:", e);
    return [];
  }
}
