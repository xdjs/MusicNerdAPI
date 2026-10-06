import { mapApifyPost } from "@/lib/instagram/mapApifyPost";
import { mapSocialPost } from "@/lib/social/mapSocialPost";
import { validateResearchUrl } from "@/lib/questionResearch/validateResearchUrl";
import type {
  DiscoveryOriginal,
  ResearchPlan,
  ResearchRequest,
} from "@/lib/questionResearch/types";

/** Keep exact own-account public text, never foreign/reposted speech or an unrelated target. */
export function mapQuestionSocialOriginal(
  item: unknown,
  plan: ResearchPlan,
  request: ResearchRequest,
  artistId: string,
  runId: string,
): DiscoveryOriginal | null {
  if (!("handle" in plan) || !item || typeof item !== "object") return null;
  const raw = item as Record<string, unknown>;
  if (raw.isRetweet === true || raw.isRepost === true || raw.error) return null;
  const row =
    plan.provider === "x" || plan.provider === "tiktok"
      ? mapSocialPost(item, artistId, plan.provider, plan.handle)
      : mapApifyPost(item, artistId, plan.handle);
  if (!row?.isOwnPost || !row.url || !row.postedAt) return null;
  let url: URL;
  try {
    url = new URL(validateResearchUrl(row.url));
  } catch {
    return null;
  }
  if (
    plan.provider.startsWith("instagram") &&
    (!["instagram.com", "www.instagram.com"].includes(url.hostname) ||
      !/^\/(?:p|reel|reels)\/[\w-]+\/?$/.test(url.pathname))
  )
    return null;
  if (plan.targetUrl) {
    const target = new URL(plan.targetUrl);
    if (target.pathname.replace(/\/$/, "") !== url.pathname.replace(/\/$/, "")) return null;
  }
  const published = new Date(row.postedAt);
  if (!Number.isFinite(published.getTime())) return null;
  if (
    (request.fromDate && published.toISOString().slice(0, 10) < request.fromDate) ||
    (request.toDate && published.toISOString().slice(0, 10) > request.toDate)
  )
    return null;
  const speech = plan.provider === "instagram_reels";
  const text = speech ? raw.transcript : row.caption;
  if (typeof text !== "string" || !text.trim()) return null;
  return {
    url: url.href,
    title: null,
    text: text.slice(0, 50000),
    identity: "confirmed",
    destination: "lore",
    provenance: {
      kind: speech ? "provider_transcript" : "caption",
      provider: plan.provider,
      publisher: row.ownerUsername,
      speaker: speech ? "unverified" : "not_applicable",
      publishedAt: published.toISOString(),
      retrievedAt: new Date().toISOString(),
      truncated: text.length > 50000,
      runId,
      limitations: [
        speech
          ? "Provider transcript; speaker identity and timestamps are not verified."
          : "Caption text is not spoken content; account ownership does not prove authorship of quoted text.",
      ],
    },
  };
}
