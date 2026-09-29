import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artistVaultSources } from "@/lib/db/schema";
import type { VaultSource } from "@/lib/vault/types";

/**
 * The artist's vault sources with one status, newest first.
 *
 * @param artistId - The artist.
 * @param status - pending, approved or rejected.
 * @returns The sources; empty on a database error, as in MusicNerdWeb.
 */
export async function getVaultSourcesByStatus(
  artistId: string,
  status: "pending" | "approved" | "rejected",
): Promise<VaultSource[]> {
  try {
    return await db.query.artistVaultSources.findMany({
      where: and(eq(artistVaultSources.artistId, artistId), eq(artistVaultSources.status, status)),
      orderBy: [desc(artistVaultSources.createdAt)],
    });
  } catch (e) {
    console.error("[getVaultSourcesByStatus] Error:", e);
    return [];
  }
}
