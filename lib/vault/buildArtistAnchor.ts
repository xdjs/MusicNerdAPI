import { IDENTITY_ANCHOR_COLUMNS } from "@/lib/artists/const";
import { artistRowProperty } from "@/lib/artists/artistRowProperty";
import type { ArtistAnchor } from "@/lib/relevance/types";
import { getSpotifyCatalogNames } from "@/lib/spotify/getSpotifyCatalogNames";
import { getSpotifyHeaders } from "@/lib/spotify/getSpotifyHeaders";

/**
 * What the relevance judge gets besides the name: the real catalog and the
 * confirmed, name-shaped accounts. That's evidence a name match doesn't have,
 * and it's what tells a Chord DAVE amplifier review from Black Dave. A catalog
 * that can't be read is left out; the judge still runs.
 *
 * @param artist - The artist row.
 * @param artistName - The artist's name.
 * @returns The anchor, with top tracks before releases.
 */
export async function buildArtistAnchor(
  artist: Record<string, unknown>,
  artistName: string,
): Promise<ArtistAnchor & { catalog: string[]; identifiers: string[] }> {
  const spotifyId = typeof artist.spotify === "string" ? artist.spotify : "";
  let catalog = { releases: [] as string[], topTracks: [] as string[] };
  if (spotifyId) {
    try {
      catalog = await getSpotifyCatalogNames(spotifyId, await getSpotifyHeaders());
    } catch {
      // No catalog: the judge runs on the name and the accounts.
    }
  }
  const identifiers = IDENTITY_ANCHOR_COLUMNS.flatMap(col => {
    const v = artist[artistRowProperty(col)];
    return typeof v === "string" && v ? [`${col}: ${v}`] : [];
  });
  return { name: artistName, catalog: [...catalog.topTracks, ...catalog.releases], identifiers };
}
