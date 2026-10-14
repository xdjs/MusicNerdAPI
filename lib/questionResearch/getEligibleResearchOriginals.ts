import { researchPlatformForUrl } from "./researchPlatformForUrl";
import { latestActivityTime } from "@/lib/latestProviders/latestActivityTime";
import { canonicalResearchUrl } from "./canonicalResearchUrl";
import type { ResearchOriginal, ResearchRequest } from "./types";

/** Apply public request scope and deduplication before any model-driven navigation. */
export function getEligibleResearchOriginals(
  originals: ResearchOriginal[],
  request: ResearchRequest,
  now = Date.now(),
): ResearchOriginal[] {
  const dateOf = (o: ResearchOriginal) => o.activityDate ?? o.publishedAt;
  const timeOf = (o: ResearchOriginal) => (dateOf(o) ? latestActivityTime(dateOf(o)!) : NaN);
  const from =
    request.fromDate ??
    (request.freshness === "recent" && request.retrieval !== "latest"
      ? new Date(now - 7 * 86400_000).toISOString().slice(0, 10)
      : undefined);
  // Promotion retains both the discovery and its Lore copy. Identical text at
  // the same URL is one original, not independent corroboration or extra rank.
  const seen = new Set<string>();
  const distinct = [...originals]
    .sort((a, b) => {
      if (request.retrieval === "latest") {
        const precision = (o: ResearchOriginal) =>
          dateOf(o) && Number.isFinite(timeOf(o)) && timeOf(o) <= now
            ? dateOf(o)!.includes("T")
              ? 2
              : 1
            : 0;
        const difference = precision(b) - precision(a);
        if (difference) return difference;
      }
      return Number(b.curation === "approved") - Number(a.curation === "approved");
    })
    .filter(original => {
      const key = `${canonicalResearchUrl(original.url)}\0${original.evidenceKind}\0${original.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const excluded = new Set((request.excludeSourceUrls ?? []).map(canonicalResearchUrl));
  const eligible = distinct.filter(
    o =>
      !excluded.has(canonicalResearchUrl(o.url)) &&
      (!request.targetUrl ||
        canonicalResearchUrl(o.url) === canonicalResearchUrl(request.targetUrl)) &&
      (!request.platform || researchPlatformForUrl(o.url) === request.platform) &&
      (request.evidenceNeed !== "spoken_content" || o.evidenceKind === "provider_transcript") &&
      (!from || (Number.isFinite(timeOf(o)) && timeOf(o) >= Date.parse(from))) &&
      (!request.toDate ||
        (Number.isFinite(timeOf(o)) && timeOf(o) < Date.parse(request.toDate) + 86400000)),
  );
  if (request.retrieval !== "latest") return eligible;
  const dated = eligible.filter(o => dateOf(o) && Number.isFinite(timeOf(o)) && timeOf(o) <= now);
  return dated;
}
