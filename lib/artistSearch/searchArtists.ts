import { fetchProviderSearchArtist } from "@/lib/artistSearch/fetchProviderSearchArtist";
import { getLinkCount } from "@/lib/artistSearch/getLinkCount";
import { parseArtistSearchQuery } from "@/lib/artistSearch/parseArtistSearchQuery";
import { searchArtistsByName } from "@/lib/artistSearch/searchArtistsByName";
import { searchForArtistByProviderId } from "@/lib/artistSearch/searchForArtistByProviderId";
import type { SearchArtistResult } from "@/lib/artistSearch/types";
import { customImageUrl } from "@/lib/artists/customImageUrl";

/** Search names or exact provider identities; reading never creates or attaches an artist. */
export async function searchArtists(
  query: string,
  bookmarkedIds: string[],
): Promise<SearchArtistResult[]> {
  const identity = parseArtistSearchQuery(query);
  if (!identity) return searchArtistsByName(query, bookmarkedIds);
  const { platform, platformId, includeNameResults } = identity;
  const saved = await searchForArtistByProviderId(platform, platformId);
  if (saved.length) {
    const savedResults: SearchArtistResult[] = saved.map(artist => ({
      ...artist,
      bio: null,
      isExternalOnly: false,
      imageUrl: customImageUrl(artist.customImage),
      matchScore: 0,
      linkCount: getLinkCount(artist),
    }));
    // Explicit identities need no provider access. Bare IDs retain ranked name search.
    if (!includeNameResults) return savedResults;
    const names = await searchArtistsByName(query, bookmarkedIds).catch(() => []);
    const savedIds = new Set(saved.map(artist => artist.id));
    return [
      ...savedResults,
      ...names.filter(artist =>
        artist.isExternalOnly
          ? artist.platform !== platform || artist.platformId !== platformId
          : !savedIds.has(artist.id),
      ),
    ];
  }
  const [directResult, nameResult] = await Promise.allSettled([
    fetchProviderSearchArtist(platform, platformId),
    includeNameResults ? searchArtistsByName(query, bookmarkedIds) : Promise.resolve([]),
  ]);
  // A failed ID lookup must not erase usable matches for an ambiguous bare name.
  if (directResult.status === "rejected") {
    if (nameResult.status === "fulfilled" && nameResult.value.length) return nameResult.value;
    throw directResult.reason;
  }
  const direct = directResult.value;
  if (nameResult.status === "rejected") {
    if (direct) return [direct];
    throw nameResult.reason;
  }
  const names = nameResult.value;
  if (!direct) return names;
  // Prefer a local row if an identity was attached while the provider read was in flight.
  const linked = names.find(artist => !artist.isExternalOnly && artist[platform] === platformId);
  if (linked) return [linked, ...names.filter(artist => artist !== linked)];
  return [
    direct,
    ...names.filter(
      artist =>
        !artist.isExternalOnly || artist.platform !== platform || artist.platformId !== platformId,
    ),
  ];
}
