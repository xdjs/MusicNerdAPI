import {
  APIFY_DATASET_TIMEOUT_MS,
  APIFY_DATASETS_URL,
  MAX_SCRAPE_LIMIT,
  THUMBNAILS_PER_SLICE,
} from "@/lib/instagram/const";
import { getArtistNameById } from "@/lib/instagram/getArtistNameById";
import { mapApifyPost } from "@/lib/instagram/mapApifyPost";
import { removeRevokedInstagramThumbnails } from "@/lib/instagram/removeRevokedInstagramThumbnails";
import { retainMappedThumbnails } from "@/lib/instagram/retainMappedThumbnails";
import { upsertMappedRows } from "@/lib/instagram/upsertMappedRows";
import type { IngestResult, SocialPostInsert, ThumbnailUploadScope } from "@/lib/instagram/types";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";
import { withResearchJobWrite } from "@/lib/research/withResearchJobWrite";

/**
 * Stores the next batch of a finished scrape: nine posts per slice, because
 * each own post's thumbnail is downloaded and uploaded within the slice's
 * sixty seconds. Thumbnails are retained outside the write lock; the write
 * itself runs under the job's guard, and if the claim was revoked meanwhile
 * this job's late uploads are removed.
 *
 * @param artistId - The artist.
 * @param handle - The artist's Instagram handle.
 * @param datasetId - The finished run's dataset.
 * @param jobId - The job doing the work.
 * @param cursor - The first post of this batch.
 * @returns The counts, with `nextCursor` while posts remain; null when the dataset could not be read, so the job retries.
 */
export async function collectInstagramScrape(
  artistId: string,
  handle: string,
  datasetId: string,
  jobId: string,
  cursor = 0,
): Promise<IngestResult | null> {
  const token = process.env.APIFY_API_TOKEN ?? "";
  if (!token) return null;
  try {
    const url = `${APIFY_DATASETS_URL}/${datasetId}/items?token=${encodeURIComponent(token)}&clean=true&format=json&limit=${MAX_SCRAPE_LIMIT}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(APIFY_DATASET_TIMEOUT_MS) });
    if (!res.ok) {
      console.error(`[collectInstagramScrape] dataset fetch failed: ${res.status}`);
      return null;
    }
    const items = await res.json();
    if (!Array.isArray(items)) return null;

    const artistName = await getArtistNameById(artistId);
    const rows = items
      .map(item => mapApifyPost(item, artistId, handle, artistName))
      .filter((r): r is SocialPostInsert => r !== null)
      .slice(0, MAX_SCRAPE_LIMIT);
    const batch = rows.slice(cursor, cursor + THUMBNAILS_PER_SLICE);
    const scope: ThumbnailUploadScope = { jobId, attemptedPaths: new Set() };
    // Reject an already revoked job before creating any storage objects.
    await withResearchJobWrite(artistId, jobId, async () => undefined);
    const prepared = await retainMappedThumbnails(batch, scope);
    let result: IngestResult;
    try {
      result = await withResearchJobWrite(artistId, jobId, tx => upsertMappedRows(prepared, tx));
    } catch (error) {
      // Every upload has settled. Revocation may already have purged the
      // artist's folder, so remove this job's late uploads explicitly.
      if (error instanceof OwnershipChangedError) {
        await removeRevokedInstagramThumbnails(artistId, scope);
      }
      throw error;
    }
    const next = cursor + batch.length;
    return next < rows.length ? { ...result, nextCursor: next } : result;
  } catch (e) {
    if (e instanceof OwnershipChangedError) throw e;
    console.error("[collectInstagramScrape] Error:", e);
    return null;
  }
}
