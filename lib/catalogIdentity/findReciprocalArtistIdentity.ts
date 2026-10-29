import { withTimeout } from "@/lib/async/withTimeout";
import { PROVIDER_VERIFICATION_TIMEOUT_MS } from "@/lib/catalogIdentity/const";
import { findWikidataCounterpart } from "@/lib/catalogIdentity/findWikidataCounterpart";
import { getArtistIdentity } from "@/lib/catalogIdentity/getArtistIdentity";
import { isCatalogPlatformId } from "@/lib/catalogIdentity/isCatalogPlatformId";
import { normalizeCatalogArtistName } from "@/lib/catalogIdentity/normalizeCatalogArtistName";
import type { CatalogArtistIdentity, ReciprocalArtistIdentity } from "@/lib/catalogIdentity/types";
import { findMusicBrainzCounterpart } from "@/lib/musicbrainz/findMusicBrainzCounterpart";

/**
 * The same artist on the other catalog platform (Spotify ↔ Deezer), as
 * MusicNerdWeb found it when adding an artist: Wikidata first, MusicBrainz
 * only on a definite Wikidata miss (never during an outage), then the other
 * platform must return exactly that id under the same name.
 *
 * @param artist - The submitted artist's platform, id and name.
 * @returns The counterpart and its evidence, or null. Never throws.
 */
export async function findReciprocalArtistIdentity(
  artist: CatalogArtistIdentity,
): Promise<ReciprocalArtistIdentity | null> {
  if (!isCatalogPlatformId(artist.platform, artist.platformId)) return null;
  const name = normalizeCatalogArtistName(artist.name);
  if (!name) return null;
  const targetPlatform = artist.platform === "deezer" ? "spotify" : "deezer";
  const tag = `${artist.platform}:${artist.platformId}`;

  let counterpart:
    | { platformId: string; source: "wikidata"; wikidataId: string }
    | { platformId: string; source: "musicbrainz"; musicbrainzId: string }
    | null = null;
  try {
    const wikidata = await findWikidataCounterpart(
      artist.platform,
      artist.platformId,
      targetPlatform,
    );
    if (wikidata.status === "ambiguous") return null;
    if (wikidata.status === "match")
      counterpart = {
        platformId: wikidata.platformId,
        source: "wikidata",
        wikidataId: wikidata.wikidataId,
      };
  } catch (error) {
    console.error(`[findReciprocalArtistIdentity] Wikidata lookup failed for ${tag}:`, error);
    return null;
  }
  if (!counterpart) {
    const musicbrainz = await findMusicBrainzCounterpart(
      artist.platform,
      artist.platformId,
      targetPlatform,
    );
    if (musicbrainz) counterpart = { ...musicbrainz, source: "musicbrainz" };
  }
  if (!counterpart) return null;

  try {
    const verified = await withTimeout(
      getArtistIdentity(targetPlatform, counterpart.platformId),
      PROVIDER_VERIFICATION_TIMEOUT_MS,
      `${targetPlatform} artist verification timed out`,
    );
    // Ownership was proved for this exact id; a redirect to another id is not proof.
    if (
      verified?.platformId?.trim() !== counterpart.platformId ||
      normalizeCatalogArtistName(verified.name) !== name
    )
      return null;
    return counterpart.source === "wikidata"
      ? {
          platform: targetPlatform,
          platformId: counterpart.platformId,
          source: "wikidata",
          wikidataId: counterpart.wikidataId,
        }
      : {
          platform: targetPlatform,
          platformId: counterpart.platformId,
          source: "musicbrainz",
          musicbrainzId: counterpart.musicbrainzId,
        };
  } catch (error) {
    console.error(
      `[findReciprocalArtistIdentity] ${targetPlatform} verification failed for ${tag}:`,
      error,
    );
    return null;
  }
}
