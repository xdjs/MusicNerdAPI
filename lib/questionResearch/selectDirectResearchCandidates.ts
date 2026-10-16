import { latestActivityTime } from "@/lib/latestProviders/latestActivityTime";
import { knowledgeWindow } from "@/lib/knowledge/knowledgeWindow";
import { canonicalResearchUrl } from "./canonicalResearchUrl";
import { diversifyResearchOriginals } from "./diversifyResearchOriginals";
import { getEligibleResearchOriginals } from "./getEligibleResearchOriginals";
import { selectResearchReferences } from "./selectResearchReferences";
import type { ResearchOriginal, ResearchRequest } from "./types";

/** Only server-normalized provider originals have a trustworthy collection identity.
 * Names are editable and nonunique. Use the chain/contract and connected timeline account.
 */
function collectionKey(original: ResearchOriginal): string | null {
  if (
    !/^latest:inprocess:[a-f0-9]{64}$/.test(original.sourceId) ||
    original.activityDateKind !== "moment" ||
    original.evidenceKind !== "original_text"
  )
    return null;
  try {
    const url = new URL(original.url);
    if (
      url.protocol !== "https:" ||
      !["inprocess.world", "www.inprocess.world"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.port
    )
      return null;
    const collection = /^\/collect\/((?:base|bsep|eth|op|zora):0x[a-f0-9]{40})\/\d+\/?$/i.exec(
      url.pathname,
    )?.[1];
    const metadata: unknown = JSON.parse(original.text);
    if (!collection || !metadata || typeof metadata !== "object" || Array.isArray(metadata))
      return null;
    const fields = metadata as Record<string, unknown>;
    if (
      fields.provider !== "inprocess" ||
      typeof fields.timeline_account !== "string" ||
      !/^0x[a-f0-9]{40}$/i.test(fields.timeline_account)
    )
      return null;
    return `collection:${fields.timeline_account.toLowerCase()}:${collection.toLowerCase()}`;
  } catch {
    return null;
  }
}

/** Offer bounded exact originals to an answer attempt; ranking never establishes sufficiency. */
export function selectDirectResearchCandidates(
  originals: ResearchOriginal[],
  request: ResearchRequest,
  artistName: string,
  now = Date.now(),
) {
  const eligible = getEligibleResearchOriginals(originals, request, now);
  const latestOverview =
    request.retrieval === "latest" &&
    request.answerScope === "overview" &&
    request.evidenceNeed === "reporting";
  const timeOf = (source: ResearchOriginal) =>
    latestActivityTime(source.activityDate ?? source.publishedAt ?? "") || 0;
  // Reporting previews prefer the written original over a transcript of the same post.
  // Recency chooses the cohort first; provider diversity cannot bring an older item into it.
  const chronological = [...eligible].sort(
    (a, b) => timeOf(b) - timeOf(a) || a.sourceId.localeCompare(b.sourceId),
  );
  const posts = new Map<string, ResearchOriginal>();
  for (const original of chronological) {
    const url = canonicalResearchUrl(original.url);
    const existing = posts.get(url);
    if (
      !existing ||
      (existing.evidenceKind === "provider_transcript" &&
        original.evidenceKind !== "provider_transcript")
    )
      posts.set(url, original);
  }
  const followupOverview =
    latestOverview && !request.targetUrl && Boolean(request.excludeSourceUrls?.length);
  const seenActivities = new Set<string>();
  const newestPosts = [...posts.values()]
    .sort((a, b) => timeOf(b) - timeOf(a) || a.sourceId.localeCompare(b.sourceId))
    .filter(original => {
      if (!followupOverview) return true;
      const key = collectionKey(original) ?? canonicalResearchUrl(original.url);
      if (seenActivities.has(key)) return false;
      seenActivities.add(key);
      return true;
    })
    .slice(0, 6);
  const references = latestOverview
    ? diversifyResearchOriginals(newestPosts).map(original => ({
        ...original,
        ...knowledgeWindow(original.text, 0, 2000),
      }))
    : selectResearchReferences(eligible, request, artistName, now);
  return {
    selection: "candidates" as const,
    references,
    coverage: {
      eligibleSources: eligible.length,
      returnedSources: new Set(references.map(reference => reference.sourceId)).size,
      returnedChars: references.reduce((total, reference) => total + reference.text.length, 0),
      exhaustive: false as const,
    },
  };
}
