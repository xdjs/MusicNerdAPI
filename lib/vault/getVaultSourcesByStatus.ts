import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artistVaultSources } from "@/lib/db/schema";
import type { VaultSource } from "@/lib/vault/types";

/**
 * The artist's vault sources, newest first: those with one status, or all of them.
 *
 * @param artistId - The artist.
 * @param status - pending, approved or rejected; omitted for every source.
 * @returns The sources; empty on a database error, as in MusicNerdWeb.
 */
export async function getVaultSourcesByStatus(
  artistId: string,
  status?: "pending" | "approved" | "rejected",
): Promise<VaultSource[]> {
  try {
    return await db.query.artistVaultSources.findMany({
      where: status
        ? and(eq(artistVaultSources.artistId, artistId), eq(artistVaultSources.status, status))
        : eq(artistVaultSources.artistId, artistId),
      orderBy: [desc(artistVaultSources.createdAt)],
    });
  } catch (e) {
    console.error("[getVaultSourcesByStatus] Error:", e);
    return [];
  }
}
