import { readResearchJson } from "@/lib/questionResearch/readResearchJson";
import { mapQuestionSocialOriginal } from "@/lib/questionResearch/mapQuestionSocialOriginal";
import type {
  ResearchPlan,
  ResearchRequest,
  DiscoveryOriginal,
} from "@/lib/questionResearch/types";
/** Read the saved bounded dataset without starting or adopting anything. */
export async function collectQuestionSocialOriginals(
  plan: ResearchPlan,
  request: ResearchRequest,
  artistId: string,
  runId: string,
  datasetId: string,
): Promise<DiscoveryOriginal[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("Social provider unavailable");
  const body = await readResearchJson(
    await fetch(
      `https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?clean=true&format=json&limit=20`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) },
    ),
  );
  if (!Array.isArray(body) || body.some(r => r && typeof r === "object" && r.error))
    throw new Error("Social dataset unavailable");
  return body.slice(0, 20).flatMap(item => {
    const mapped = mapQuestionSocialOriginal(item, plan, request, artistId, runId);
    return mapped ? [mapped] : [];
  });
}
