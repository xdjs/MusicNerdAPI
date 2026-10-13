import { arrayContains } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { lookupArtists, type LookupArtist } from "@/lib/artistLookups/lookupArtists";

/**
 * The first artist whose `wallets` contain the address, as MusicNerdWeb's
 * `getArtistbyWallet` matched it (exact, case-sensitive).
 *
 * @param wallet - The address.
 * @returns The whole row, or undefined; throws on a database error.
 */
export async function findArtistByWallet(wallet: string): Promise<LookupArtist | undefined> {
  const rows = await db
    .select()
    .from(lookupArtists)
    .where(arrayContains(lookupArtists.wallets, [wallet]))
    .limit(1);
  return rows[0];
}
