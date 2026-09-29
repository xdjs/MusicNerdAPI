import { getArtistById } from "@/lib/artists/getArtistById";
import { appendSocialCredits } from "@/lib/credits/appendSocialCredits";
import { extractCaptionCredits } from "@/lib/credits/extractCaptionCredits";
import { getSocialPostsOrNull } from "@/lib/instagram/getSocialPostsOrNull";
import { captionsToRead } from "@/lib/research/captionsToRead";
import { completeResearchJob } from "@/lib/research/completeResearchJob";
import { failJobAtCursor } from "@/lib/research/failJobAtCursor";
import { failResearchJob } from "@/lib/research/failResearchJob";
import { rebuildAfterCaptions } from "@/lib/research/rebuildAfterCaptions";
import { resolveExtractionMode } from "@/lib/research/resolveExtractionMode";
import { saveJobProgress } from "@/lib/research/saveJobProgress";
import { sweepCaptionJob } from "@/lib/research/sweepCaptionJob";
import type { ResearchJob, SliceOutcome } from "@/lib/research/types";

/**
 * One slice of a `caption_extract` job: read as many caption batches as fit,
 * store what they verify, and hand the lease back. When every batch is read,
 * sweep the silent captions, then rebuild the Lore once. Rebuilding per slice
 * would change the artist's page three times for three model calls.
 *
 * @param job - The claimed job.
 * @param deadline - When this slice must stop.
 * @returns What the slice did.
 */
export async function runCaptionExtract(job: ResearchJob, deadline: number): Promise<SliceOutcome> {
  const artist = await getArtistById(job.artistId);
  if (!artist?.name) {
    await completeResearchJob(job.id);
    return { progress: "no artist", done: true };
  }

  const posts = await getSocialPostsOrNull(job.artistId);
  if (posts === null) {
    await failResearchJob(job.id, "could not read stored posts");
    return { progress: "post lookup failed, will retry", done: false };
  }
  if (posts.length === 0) {
    // Recorded as done, so "found nothing" is never confused with "has not run".
    await completeResearchJob(job.id);
    return { progress: "no posts", done: true };
  }

  const incremental = await resolveExtractionMode(job);
  const toRead = await captionsToRead(job, posts, incremental);
  if (incremental && toRead.length === 0) {
    await completeResearchJob(job.id);
    return { progress: "nothing new to read", done: true };
  }

  const read = await extractCaptionCredits(toRead, artist.name, artist.instagram ?? "", {
    startBatch: job.cursor,
    budgetMs: Math.max(0, deadline - Date.now()),
  });
  // An undated post is stored as "" on the row we read; the credit's posted_at is a timestamp.
  const postedAtByUrl = new Map(posts.map(p => [p.url, p.postedAt || null] as const));
  const stored = await appendSocialCredits(job.artistId, read.extraction, postedAtByUrl, job.id);
  if (stored === null) {
    // Verified and then not written: advancing the cursor would lose them.
    await failResearchJob(job.id, "could not store extracted credits");
    return { progress: "storage failed, cursor held", done: false };
  }
  if (read.failed) {
    await failJobAtCursor(
      job.id,
      read.nextBatch,
      read.totalBatches,
      job.state,
      "a caption batch could not be read",
    );
    return { progress: `read up to batch ${read.nextBatch}, will retry`, done: false };
  }
  if (!read.done) {
    await saveJobProgress(job.id, read.nextBatch, { total: read.totalBatches, state: job.state });
    return {
      progress: `batch ${read.nextBatch}/${read.totalBatches}, +${stored} row(s)`,
      done: false,
    };
  }

  const sweeping = await sweepCaptionJob(
    job,
    toRead,
    { name: artist.name, instagram: artist.instagram },
    postedAtByUrl,
    read,
    deadline,
  );
  if (sweeping) return sweeping;
  // MusicNerdWeb also clears its grounded-questions cache here. That cache lives
  // in MusicNerdWeb's process, so there is nothing to clear from this one.
  return rebuildAfterCaptions(job, read, deadline);
}
