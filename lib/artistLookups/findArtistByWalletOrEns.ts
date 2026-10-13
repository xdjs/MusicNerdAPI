import { findArtistByColumn } from "@/lib/artistLookups/findArtistByColumn";
import { findArtistByWallet } from "@/lib/artistLookups/findArtistByWallet";
import { lookupArtists, type LookupArtist } from "@/lib/artistLookups/lookupArtists";

const WALLET = /^0x[a-fA-F0-9]{40}$/;

/**
 * The artist for an `ethAddress`, as MusicNerdWeb's `getArtistByWalletOrEns`
 * found it: a `0x` address is matched against wallets, then ENS; anything else
 * against ENS only.
 *
 * @param value - The address or ENS name.
 * @returns The whole row, or undefined; throws on a database error.
 */
export async function findArtistByWalletOrEns(value: string): Promise<LookupArtist | undefined> {
  if (WALLET.test(value)) {
    const artist = await findArtistByWallet(value);
    if (artist) return artist;
  }
  return findArtistByColumn(lookupArtists.ens, value);
}
