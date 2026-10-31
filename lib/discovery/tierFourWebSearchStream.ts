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
 * @param requireComplete - Report failure after retaining successful platform results.
 * @yields `[platform, candidates]` for each searched platform.
 */
export async function* tierFourWebSearchStream(
  artistName: string,
  enrichment: MusicPlatformArtist | null,
  missing: Set<ProfileDisplayColumn>,
  requireComplete = false,
): AsyncGenerator<[ProfileDisplayColumn, TierCandidate[] | null]> {
  const platforms = (Object.keys(HANDLE_BASED_PLATFORM_DOMAINS) as ProfileDisplayColumn[]).filter(
    p => missing.has(p),
  );
  if (platforms.length === 0) return;
  const query = buildTierFourQuery(artistName, enrichment);
  const failures: unknown[] = [];
  yield* settleAsCompleted(
    platforms.map(
      platform =>
        [
          platform,
          searchPlatformCandidates(platform, query, artistName, requireComplete).catch(error => {
            failures.push(error);
            throw error;
          }),
        ] as [ProfileDisplayColumn, Promise<TierCandidate[]>],
    ),
  );
  if (requireComplete && failures.length > 0) throw failures[0];
}
