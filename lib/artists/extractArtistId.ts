import { getAllLinks } from "@/lib/artists/getAllLinks";
import { matchUrlmapRow } from "@/lib/artists/matchUrlmapRow";
import { rewriteTwitterHost } from "@/lib/artists/rewriteTwitterHost";
import { soundcloudFallback } from "@/lib/artists/soundcloudFallback";
import type { ExtractedArtistId } from "@/lib/artists/types";

/**
 * Resolves a URL to a platform and the artist's id on it, using the urlmap
 * patterns in table order; the first row that matches decides.
 *
 * @param artistUrl - A profile URL, scheme optional.
 * @returns The platform, its display name and the id; null when no platform reads it.
 */
export async function extractArtistId(artistUrl: string): Promise<ExtractedArtistId | null> {
  let decodedUrl = artistUrl;
  try {
    decodedUrl = decodeURIComponent(artistUrl);
  } catch {
    // Not valid percent-encoding; match the URL as given.
  }
  decodedUrl = rewriteTwitterHost(decodedUrl);

  const allLinks = await getAllLinks();
  for (const row of allLinks) {
    const reading = matchUrlmapRow(row, decodedUrl);
    if (reading !== undefined) return reading;
  }
  return soundcloudFallback(artistUrl, allLinks);
}
