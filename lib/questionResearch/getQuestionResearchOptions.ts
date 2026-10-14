import { planQuestionResearch } from "./planQuestionResearch";
import type { ResearchRequest, ResearchArtist, ResearchPlan } from "./types";

/** Offer only executable, account-bound lookups within the caller's source scope. */
export function getQuestionResearchOptions(
  request: ResearchRequest,
  artist: ResearchArtist,
): ResearchPlan[] {
  const base = planQuestionResearch(request, artist);
  if (request.targetUrl || request.platform) return base.provider ? [base] : [];
  const candidates = [
    base,
    ...(["instagram", "tiktok", "x"] as const).map(platform =>
      planQuestionResearch({ ...request, platform }, artist),
    ),
  ];
  const seen = new Set<string>();
  return candidates.filter(plan => {
    if (!plan.provider || seen.has(plan.provider)) return false;
    seen.add(plan.provider);
    return true;
  });
}
