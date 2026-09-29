import { settleAsCompleted } from "@/lib/async/settleAsCompleted";
import { findDeezerCandidate } from "@/lib/discovery/findDeezerCandidate";
import { findSpotifyCandidate } from "@/lib/discovery/findSpotifyCandidate";
import type { TierCandidate } from "@/lib/discovery/types";
import type { ProfileDisplayColumn } from "@/lib/links/types";

/**
 * Tier 2: Spotify and Deezer's own searches, in parallel, each yielded as it
 * settles so neither waits on the other.
 *
 * @param artistName - The resolved name.
 * @param missing - Columns still to find.
 * @param record - The artist row.
 * @yields `[platform, candidate | null]` for each missing platform of the two.
 */
export async function* tierTwoPlatformSearchStream(
  artistName: string,
  missing: Set<ProfileDisplayColumn>,
  record: Record<string, unknown>,
): AsyncGenerator<[ProfileDisplayColumn, TierCandidate | null]> {
  const jobs: [ProfileDisplayColumn, Promise<TierCandidate | null>][] = [];
  if (missing.has("spotify")) jobs.push(["spotify", findSpotifyCandidate(artistName, record)]);
  if (missing.has("deezer")) jobs.push(["deezer", findDeezerCandidate(artistName)]);
  yield* settleAsCompleted(jobs);
}
