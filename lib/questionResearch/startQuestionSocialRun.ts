import { readResearchJson } from "@/lib/questionResearch/readResearchJson";
import type { ResearchPlan, ResearchRequest } from "@/lib/questionResearch/types";

/** Start one allowlisted, charged-capped run after the worker has persisted its reservation. */
export async function startQuestionSocialRun(
  plan: ResearchPlan,
  request: ResearchRequest,
): Promise<string> {
  if (
    !["instagram", "instagram_reels", "tiktok", "x"].includes(plan.provider ?? "") ||
    !("handle" in plan)
  )
    throw new Error("Unsupported social route");
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("Social provider unavailable");
  const limit = plan.targetUrl ? 1 : Math.min(20, plan.limit);
  let actor: string;
  let input: Record<string, unknown>;
  let cap: number;
  if (plan.provider === "tiktok") {
    actor = "clockworks~tiktok-scraper";
    cap = 0.5;
    input = {
      ...(plan.targetUrl
        ? { postURLs: [plan.targetUrl] }
        : {
            profiles: [plan.handle],
            profileScrapeSections: ["videos"],
            profileSorting: "latest",
            excludePinnedPosts: true,
          }),
      resultsPerPage: limit,
      shouldDownloadVideos: false,
      downloadSubtitlesOptions: "NEVER_DOWNLOAD_SUBTITLES",
      shouldDownloadCovers: false,
      shouldDownloadAvatars: false,
      shouldDownloadMusicCovers: false,
      shouldDownloadSlideshowImages: false,
      scrapeRelatedVideos: false,
    };
  } else if (plan.provider === "x") {
    actor = "apidojo~tweet-scraper";
    cap = 0.05;
    input = {
      ...(plan.targetUrl
        ? { startUrls: [plan.targetUrl] }
        : {
            searchTerms: [
              `from:${plan.handle} -filter:retweets${request.fromDate ? ` since:${request.fromDate}` : ""}${request.toDate ? ` until:${new Date(new Date(request.toDate).getTime() + 86400000).toISOString().slice(0, 10)}` : ""}`,
            ],
          }),
      sort: "Latest",
      maxItems: limit,
    };
  } else if (plan.provider === "instagram_reels") {
    actor = "apify~instagram-reel-scraper";
    cap = 0.5;
    input = {
      username: [plan.targetUrl],
      resultsLimit: 1,
      includeTranscript: true,
      includeDownloadedVideo: false,
      includeSharesCount: false,
    };
  } else {
    actor = "apify~instagram-scraper";
    cap = 0.1;
    input = {
      directUrls: [plan.targetUrl ?? `https://www.instagram.com/${plan.handle}/`],
      resultsType: "posts",
      resultsLimit: limit,
      addParentData: false,
      ...(request.fromDate ? { onlyPostsNewerThan: request.fromDate } : {}),
    };
  }
  const query = new URLSearchParams({
    maxItems: String(limit),
    maxTotalChargeUsd: String(cap),
    timeout: "600",
  });
  const body = (await readResearchJson(
    await fetch(`https://api.apify.com/v2/acts/${actor}/runs?${query}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(20_000),
    }),
  )) as { data?: { id?: unknown } };
  if (typeof body?.data?.id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.data.id))
    throw new Error("Social start outcome unknown");
  return body.data.id;
}
