import { arrayContains } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { legacyArtists, type LegacyArtist } from "@/lib/legacyLookups/legacyArtists";

/**
 * The first artist whose `wallets` contain the address, as MusicNerdWeb's
 * `getArtistbyWallet` matched it (exact, case-sensitive).
 *
 * @param wallet - The address.
 * @returns The whole row, or undefined; throws on a database error.
 */
export async function findLegacyArtistByWallet(wallet: string): Promise<LegacyArtist | undefined> {
  const rows = await db
    .select()
    .from(legacyArtists)
    .where(arrayContains(legacyArtists.wallets, [wallet]))
    .limit(1);
  return rows[0];
}
