import { connectedResearchHandle } from "@/lib/questionResearch/connectedResearchHandle";
import { validateResearchUrl } from "@/lib/questionResearch/validateResearchUrl";
import type { ResearchRequest, ResearchArtist, ResearchPlan } from "@/lib/questionResearch/types";

/** Select an implemented source route; identity and speech capability constrain paid work. */
export function planQuestionResearch(
  request: ResearchRequest,
  artist: ResearchArtist,
): ResearchPlan {
  const targetUrl = request.targetUrl ? validateResearchUrl(request.targetUrl) : undefined;
  const url = targetUrl ? new URL(targetUrl) : null;
  const host = url?.hostname.replace(/^www\./, "");
  const latestPlatform =
    !targetUrl &&
    request.retrieval === "latest" &&
    ["reporting", "social_caption"].includes(request.evidenceNeed)
      ? (["instagram", "tiktok", "x"] as const).find(p => connectedResearchHandle(artist[p], p))
      : undefined;
  const platform =
    host === "instagram.com"
      ? "instagram"
      : host === "tiktok.com"
        ? "tiktok"
        : host === "x.com" || host === "twitter.com"
          ? "x"
          : (request.platform ?? latestPlatform);
  const unresolved = (reason: string): ResearchPlan => ({
    provider: null,
    stage: "unresolved",
    reason,
  });
  if (
    request.evidenceNeed === "spoken_content" &&
    (platform !== "instagram" || (url && host !== "instagram.com"))
  )
    return unresolved("unsupported_speech");
  if (platform) {
    const handle = connectedResearchHandle(artist[platform], platform);
    if (!handle) return unresolved("connected_account_required");
    if (
      url &&
      (host === "instagram.com" ||
        host === "tiktok.com" ||
        host === "x.com" ||
        host === "twitter.com")
    ) {
      const pattern =
        platform === "instagram"
          ? /^\/(?:p|reel|reels)\/([\w-]+)\/?$/
          : platform === "tiktok"
            ? /^\/@([\w.]+)\/video\/(\d+)\/?$/
            : /^\/([\w]+)\/status\/(\d+)\/?$/;
      const match = pattern.exec(url.pathname);
      if (!match) return unresolved("specific_post_required");
      if (platform !== "instagram" && match[1].toLowerCase() !== handle.toLowerCase())
        return unresolved("account_mismatch");
    } else if (url)
      return {
        provider: "page",
        stage: "reading",
        targetUrl: targetUrl!,
        reason: "explicit_original",
      };
    if (request.evidenceNeed === "spoken_content") {
      if (!url || !/^\/reels?\//.test(url.pathname)) return unresolved("specific_post_required");
      return {
        provider: "instagram_reels",
        stage: "transcribing",
        targetUrl,
        handle,
        limit: 1,
        reason: "requested_spoken_original",
      };
    }
    return {
      provider: platform,
      stage: "reading",
      handle,
      ...(targetUrl ? { targetUrl } : {}),
      limit: targetUrl ? 1 : 20,
      reason: targetUrl ? "exact_public_post" : "bounded_connected_account",
    };
  }
  if (targetUrl)
    return { provider: "page", stage: "reading", targetUrl, reason: "explicit_original" };
  const suffix =
    request.evidenceNeed === "credits"
      ? "credits liner notes official release"
      : request.evidenceNeed === "release_date"
        ? "official release date edition"
        : "music interview original";
  return {
    provider: "web",
    stage: "searching",
    query: `"${(artist.name ?? "").replace(/"/g, "")}" ${request.topic} ${suffix}`,
    reason:
      request.evidenceNeed === "credits" || request.evidenceNeed === "release_date"
        ? "work_specific_originals"
        : "public_original_discovery",
  };
}
