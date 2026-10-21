import { eq, sql } from "drizzle-orm";
import { ArtistLinkConflictError } from "@/lib/artistLinks/ArtistLinkConflictError";
import { setArtistLink } from "@/lib/artistLinks/setArtistLink";
import { ugcresearch } from "@/lib/db/schema";
import type { TransactionDb } from "@/lib/ownership/types";

/**
 * Approves a UGC link suggestion: writes the platform value onto the artist
 * (a YouTube channel id or handle is normalized first; a wallet is appended
 * to the array) and marks the row accepted, in the review's transaction.
 *
 * @param ugcId - The ugcresearch row.
 * @param artistId - The artist.
 * @param siteName - The platform column.
 * @param artistUrlOrId - The submitted id or URL.
 * @param transaction - The review's transaction.
 * @returns Nothing; rethrows ArtistLinkConflictError, wraps anything else as `Error approving UGC: …`.
 */
export async function approveUGC(
  ugcId: string,
  artistId: string,
  siteName: string,
  artistUrlOrId: string,
  transaction: TransactionDb,
): Promise<void> {
  try {
    let valueToStore = artistUrlOrId;
    if (siteName === "youtubechannel") {
      try {
        const url = new URL(
          artistUrlOrId.startsWith("http") ? artistUrlOrId : `https://${artistUrlOrId}`,
        );
        const parts = url.pathname.split("/").filter(Boolean);
        const channelIdx = parts.findIndex(p => p.toLowerCase() === "channel");
        if (channelIdx !== -1 && parts[channelIdx + 1]) valueToStore = parts[channelIdx + 1];
      } catch {
        const m = artistUrlOrId.match(/youtube\.com\/channel\/([^/?#]+)/i);
        if (m) valueToStore = m[1];
      }
    } else if (siteName === "youtube") {
      try {
        if (artistUrlOrId.includes("youtube.com")) {
          const url = new URL(
            artistUrlOrId.startsWith("http") ? artistUrlOrId : `https://${artistUrlOrId}`,
          );
          const atMatch = url.pathname.match(/@([^/?#]+)/);
          if (atMatch && atMatch[1]) valueToStore = atMatch[1];
        } else if (artistUrlOrId.startsWith("@")) {
          valueToStore = artistUrlOrId.slice(1);
        }
      } catch {
        // Not a URL; store as given.
      }
    }

    if (siteName === "wallets" || siteName === "wallet") {
      await transaction.execute(sql`
        UPDATE artists
        SET wallets = array_append(wallets, ${artistUrlOrId})
        WHERE id = ${artistId} AND NOT wallets @> ARRAY[${artistUrlOrId}]
      `);
    } else {
      await setArtistLink(artistId, siteName, valueToStore, undefined, transaction);
    }

    await transaction
      .update(ugcresearch)
      .set({ accepted: true, dateProcessed: new Date().toISOString() })
      .where(eq(ugcresearch.id, ugcId));
  } catch (e) {
    console.error(`Error approving ugc`, e);
    if (e instanceof ArtistLinkConflictError) throw e;
    throw new Error(
      e instanceof Error ? `Error approving UGC: ${e.message}` : "Error approving UGC",
    );
  }
}
