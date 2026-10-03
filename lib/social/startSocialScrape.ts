import { APIFY_CONTROL_TIMEOUT_MS } from "@/lib/instagram/const";
import type { ApifyRunState } from "@/lib/instagram/types";
import {
  SOCIAL_ACTORS,
  SOCIAL_CHARGE_CAPS,
  SOCIAL_POST_LIMIT,
  type SocialTask,
} from "@/lib/social/types";

/** Starts a bounded async actor run; later slices reuse its saved id. */
export async function startSocialScrape(task: SocialTask): Promise<ApifyRunState> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) return { status: "failed", reason: "no apify token" };
  const limit = task.source === "reels" ? (task.reels?.length ?? 0) : SOCIAL_POST_LIMIT;
  if (limit < 1) return { status: "failed", reason: "no scrape targets" };
  const input =
    task.source === "tiktok"
      ? {
          profiles: [task.handle],
          resultsPerPage: limit,
          profileScrapeSections: ["videos"],
          profileSorting: "latest",
          excludePinnedPosts: true,
          shouldDownloadVideos: false,
          shouldDownloadSubtitles: false,
          shouldDownloadCovers: false,
          shouldDownloadAvatars: false,
          shouldDownloadMusicCovers: false,
          shouldDownloadSlideshowImages: false,
        }
      : task.source === "x"
        ? {
            searchTerms: [`from:${task.handle} -filter:retweets`],
            sort: "Latest",
            maxItems: limit,
          }
        : {
            username: task.reels!.map(r => r.url),
            resultsLimit: 1,
            includeTranscript: true,
            includeDownloadedVideo: false,
            includeSharesCount: false,
          };
  const query = new URLSearchParams({
    maxTotalChargeUsd: String(SOCIAL_CHARGE_CAPS[task.source]),
    maxItems: String(limit),
    timeout: "600",
  });
  try {
    const response = await fetch(
      `https://api.apify.com/v2/acts/${SOCIAL_ACTORS[task.source]}/runs?${query}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(APIFY_CONTROL_TIMEOUT_MS),
      },
    );
    if (!response.ok) return { status: "failed", reason: `apify start ${response.status}` };
    const body = (await response.json()) as { data?: { id?: unknown } };
    return typeof body.data?.id === "string" && body.data.id
      ? { status: "started", runId: body.data.id }
      : { status: "failed", reason: "apify returned no run id" };
  } catch {
    return { status: "failed", reason: "apify start unavailable" };
  }
}
