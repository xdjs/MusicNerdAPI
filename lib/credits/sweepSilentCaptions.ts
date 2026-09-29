import { EMPTY_EXTRACTION } from "@/lib/credits/const";
import { captionBearingPosts } from "@/lib/credits/captionBearingPosts";
import { extractCaptionCredits } from "@/lib/credits/extractCaptionCredits";
import type { ExtractionSlice } from "@/lib/credits/types";
import type { SocialPostRow } from "@/lib/instagram/types";

/**
 * A second look at the captions that produced nothing. The model is not
 * exhaustive and what it skips varies run to run, so this revisits only the
 * silent ones, once every batch has been read. It returns the slice, since a
 * big sweep needs more than one.
 *
 * @param allPosts - The artist's stored posts.
 * @param claimedUrls - Posts that already have a credit or statement.
 * @param artistName - The artist's name.
 * @param artistHandle - The artist's handle.
 * @param opts - Where to resume and how long to take.
 * @param opts.budgetMs - The time available.
 * @param opts.startBatch - The sweep batch to resume from.
 * @returns What the sweep found and where it stopped.
 */
export async function sweepSilentCaptions(
  allPosts: SocialPostRow[],
  claimedUrls: Set<string>,
  artistName: string,
  artistHandle: string,
  opts?: { budgetMs?: number; startBatch?: number },
): Promise<ExtractionSlice> {
  const silent = captionBearingPosts(allPosts).filter(p => !claimedUrls.has(p.url));
  if (silent.length === 0) {
    return { extraction: EMPTY_EXTRACTION, nextBatch: 0, totalBatches: 0, done: true };
  }
  const slice = await extractCaptionCredits(silent, artistName, artistHandle, opts);
  console.debug(
    `[socialCredits] ${artistName}: swept ${slice.nextBatch}/${slice.totalBatches} batch(es) of ${silent.length} silent caption(s), recovered ${slice.extraction.credits.length + slice.extraction.statements.length} claim(s)`,
  );
  return slice;
}
