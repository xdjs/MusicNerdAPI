import { APIFY_DATASET_TIMEOUT_MS, APIFY_DATASETS_URL } from "@/lib/instagram/const";
import { upsertSocialPost } from "@/lib/instagram/upsertSocialPost";
import { withResearchJobWrite } from "@/lib/research/withResearchJobWrite";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";
import { mapSocialPost } from "@/lib/social/mapSocialPost";
import { storeReelTranscript } from "@/lib/social/storeReelTranscript";
import { socialTaskIsConnected } from "@/lib/social/socialTaskIsConnected";
import { SOCIAL_POST_LIMIT, type SocialTask } from "@/lib/social/types";

/** Collects a bounded immutable dataset under the existing job write guard; null means retry. */
export async function collectSocialScrape(
  artistId: string,
  jobId: string,
  task: SocialTask,
): Promise<number | null> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token || !task.datasetId) return null;
  try {
    const response = await fetch(
      `${APIFY_DATASETS_URL}/${encodeURIComponent(task.datasetId)}/items?clean=true&format=json&limit=${SOCIAL_POST_LIMIT}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(APIFY_DATASET_TIMEOUT_MS),
      },
    );
    if (!response.ok) return null;
    const items = (await response.json()) as unknown;
    if (!Array.isArray(items) || items.some(item => item && typeof item === "object" && item.error))
      return null;
    return await withResearchJobWrite(artistId, jobId, async writer => {
      if (!(await socialTaskIsConnected(artistId, task, writer)))
        throw new Error("social profile changed during collection");
      let stored = 0;
      for (const item of items.slice(0, SOCIAL_POST_LIMIT)) {
        if (task.source === "reels") {
          if (await storeReelTranscript(item, artistId, task, writer)) stored++;
        } else {
          const row = mapSocialPost(item, artistId, task.source, task.handle);
          if (row) {
            await upsertSocialPost(row, writer);
            stored++;
          }
        }
      }
      return stored;
    });
  } catch (error) {
    if (error instanceof OwnershipChangedError) throw error;
    return null;
  }
}
