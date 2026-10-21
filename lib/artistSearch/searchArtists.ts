import { EXTERNAL_SEARCH_LIMIT } from "@/lib/artistSearch/const";
import { getLinkCount } from "@/lib/artistSearch/getLinkCount";
import { getMatchScore } from "@/lib/artistSearch/getMatchScore";
import { searchForArtistByName } from "@/lib/artistSearch/searchForArtistByName";
import type { SearchArtistResult } from "@/lib/artistSearch/types";
import { customImageUrl } from "@/lib/artists/customImageUrl";
import { getArtistImages } from "@/lib/musicPlatform/getArtistImages";
import { searchDeezerArtists } from "@/lib/musicPlatform/searchDeezerArtists";

/**
 * MusicNerdWeb's combined artist search: Music Nerd's artists and Deezer's,
 * searched at once, merged and ranked. Names are not identities: Deezer
 * artists already linked here are dropped, the rest stay `isExternalOnly` so
 * the add/duplicate-review flow can verify them. Platform images are fetched
 * only for artists whose own upload won't win.
 *
 * @param query - The name searched for.
 * @param bookmarkedIds - The caller's bookmarked artists; they rank first within a tier.
 * @returns The ranked results.
 */
export async function searchArtists(
  query: string,
  bookmarkedIds: string[],
): Promise<SearchArtistResult[]> {
  const [dbResults, externalResults] = await Promise.all([
    searchForArtistByName(query),
    searchDeezerArtists(query, EXTERNAL_SEARCH_LIMIT).catch(err => {
      console.error("External platform search failed:", err);
      return [];
    }),
  ]);

  const existingPlatformIds = new Set<string>();
  for (const artist of dbResults ?? []) {
    if (artist.deezer) existingPlatformIds.add(`deezer:${artist.deezer}`);
    if (artist.spotify) existingPlatformIds.add(`spotify:${artist.spotify}`);
  }

  const newExternalResults: SearchArtistResult[] = externalResults
    .filter(ext => !existingPlatformIds.has(`${ext.platform}:${ext.platformId}`))
    .map(ext => ({
      id: null,
      name: ext.name,
      platformId: ext.platformId,
      platform: ext.platform,
      imageUrl: ext.imageUrl,
      profileUrl: ext.profileUrl,
      isExternalOnly: true,
      matchScore: getMatchScore(ext.name, query),
      linkCount: 0,
    }));

  const withoutUpload = (dbResults ?? []).filter(artist => !customImageUrl(artist.customImage));
  let imageMap = new Map<string, string>();
  try {
    imageMap = await getArtistImages(withoutUpload);
  } catch (error) {
    console.error("Failed to fetch platform images:", error);
  }

  const dbArtistsWithImages: SearchArtistResult[] = (dbResults ?? []).map(artist => ({
    ...artist,
    bio: null, // Search results carry identity; About uses its claim-checked endpoint.
    isExternalOnly: false,
    imageUrl: customImageUrl(artist.customImage) ?? imageMap.get(artist.id) ?? null,
    matchScore: getMatchScore(artist.name || "", query),
    linkCount: getLinkCount(artist),
  }));

  return [...dbArtistsWithImages, ...newExternalResults].sort((a, b) => {
    if (a.matchScore !== b.matchScore) return a.matchScore - b.matchScore;
    const aIsBookmarked = bookmarkedIds.includes(a.id || "");
    const bIsBookmarked = bookmarkedIds.includes(b.id || "");
    if (aIsBookmarked !== bIsBookmarked) return bIsBookmarked ? 1 : -1;
    if ((a.linkCount ?? 0) !== (b.linkCount ?? 0)) return (b.linkCount ?? 0) - (a.linkCount ?? 0);
    return (a.name || "").localeCompare(b.name || "");
  });
}
