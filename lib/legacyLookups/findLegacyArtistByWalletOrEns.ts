import { findLegacyArtist } from "@/lib/legacyLookups/findLegacyArtist";
import { findLegacyArtistByWallet } from "@/lib/legacyLookups/findLegacyArtistByWallet";
import { legacyArtists, type LegacyArtist } from "@/lib/legacyLookups/legacyArtists";

const WALLET = /^0x[a-fA-F0-9]{40}$/;

/**
 * The artist for an `ethAddress`, as MusicNerdWeb's `getArtistByWalletOrEns`
 * found it: a `0x` address is matched against wallets, then ENS; anything else
 * against ENS only.
 *
 * @param value - The address or ENS name.
 * @returns The whole row, or undefined; throws on a database error.
 */
export async function findLegacyArtistByWalletOrEns(
  value: string,
): Promise<LegacyArtist | undefined> {
  if (WALLET.test(value)) {
    const artist = await findLegacyArtistByWallet(value);
    if (artist) return artist;
  }
  return findLegacyArtist(legacyArtists.ens, value);
}
