import { settleAsCompleted } from "@/lib/async/settleAsCompleted";
import { buildTierFourQuery } from "@/lib/discovery/buildTierFourQuery";
import { HANDLE_BASED_PLATFORM_DOMAINS } from "@/lib/discovery/const";
import { searchPlatformCandidates } from "@/lib/discovery/searchPlatformCandidates";
import type { TierCandidate } from "@/lib/discovery/types";
import type { ProfileDisplayColumn } from "@/lib/links/types";
import type { MusicPlatformArtist } from "@/lib/musicPlatform/types";

/**
 * Tier 4, the last resort: one domain-scoped web search per still-missing
 * handle platform, in parallel, each yielded as it settles.
 *
 * @param artistName - The resolved name.
 * @param enrichment - Their platform data, for a genre in the query.
 * @param missing - Columns still to find.
 * @yields `[platform, candidates]` for each searched platform.
 */
export async function* tierFourWebSearchStream(
  artistName: string,
  enrichment: MusicPlatformArtist | null,
  missing: Set<ProfileDisplayColumn>,
): AsyncGenerator<[ProfileDisplayColumn, TierCandidate[] | null]> {
  const platforms = (Object.keys(HANDLE_BASED_PLATFORM_DOMAINS) as ProfileDisplayColumn[]).filter(
    p => missing.has(p),
  );
  if (platforms.length === 0) return;
  const query = buildTierFourQuery(artistName, enrichment);
  yield* settleAsCompleted(
    platforms.map(
      platform =>
        [platform, searchPlatformCandidates(platform, query, artistName)] as [
          ProfileDisplayColumn,
          Promise<TierCandidate[]>,
        ],
    ),
  );
}
