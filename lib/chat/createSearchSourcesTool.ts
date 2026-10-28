import { tool } from "ai";
import { z } from "zod";
import { getQuerySnippet } from "@/lib/chat/getQuerySnippet";
import { getSourceTitle } from "@/lib/chat/getSourceTitle";
import { getEligibleResearchOriginals } from "@/lib/questionResearch/getEligibleResearchOriginals";
import { selectResearchReferences } from "@/lib/questionResearch/selectResearchReferences";
import type { ResearchOriginal, ResearchRequest } from "@/lib/questionResearch/types";

const MAX_SOURCES = 8;
const SNIPPET_CHARS = 300;

/**
 * The chat's `searchSources` tool: up to 8 of the artist's stored public
 * sources, those matching the query first (the shared original-text ranking),
 * then the rest, each with its best-matching passage. Reads stored text only.
 *
 * @param originals - The artist's stored originals (`loadPublicResearchOriginals`).
 * @param artistName - The artist's name, for ranking.
 * @returns The tool.
 */
export function createSearchSourcesTool(originals: ResearchOriginal[], artistName: string) {
  return tool({
    description:
      "Search the artist's saved sources. Returns up to 8, each with the passage that best matches the query; read one with readSource before citing it. For newest/recent activity use retrieval=latest, and platform when the question names one. Use evidenceNeed=release_date for latest releases. Dates describe stored evidence, not complete live coverage.",
    inputSchema: z.object({
      query: z.string().min(1).max(300),
      retrieval: z.enum(["relevance", "latest"]).optional(),
      platform: z.enum(["instagram", "tiktok", "x", "inprocess", "spotify", "deezer"]).optional(),
      evidenceNeed: z
        .enum(["reporting", "release_date", "credits", "social_caption", "spoken_content"])
        .optional(),
    }),
    execute: async ({ query, retrieval = "relevance", platform, evidenceNeed = "reporting" }) => {
      const request: ResearchRequest = {
        topic: query,
        evidenceNeed,
        freshness: "stored",
        retrieval,
        platform,
        answerScope: "overview",
      };
      const ranked = selectResearchReferences(originals, request, artistName);
      const seen = new Set<string>();
      const candidates =
        retrieval === "latest"
          ? ranked
          : [...ranked, ...getEligibleResearchOriginals(originals, request)];
      const sources = candidates
        .filter(source => !seen.has(source.sourceId) && seen.add(source.sourceId))
        .slice(0, MAX_SOURCES)
        .map(source => ({
          sourceId: source.sourceId,
          title: getSourceTitle(source.url),
          url: source.url,
          snippet: getQuerySnippet(source.text, query, SNIPPET_CHARS),
          publishedAt: source.publishedAt,
          activityDate: source.activityDate ?? null,
          retrievedAt: source.retrievedAt,
        }));
      return {
        sources,
        coverage:
          "Only stored sources were searched; dates do not establish complete live coverage.",
      };
    },
  });
}
