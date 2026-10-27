import { tool } from "ai";
import { z } from "zod";
import { getSourceTitle } from "@/lib/chat/getSourceTitle";
import { getEligibleResearchOriginals } from "@/lib/questionResearch/getEligibleResearchOriginals";
import { selectResearchReferences } from "@/lib/questionResearch/selectResearchReferences";
import type { ResearchOriginal, ResearchRequest } from "@/lib/questionResearch/types";

const MAX_SOURCES = 8;
const SNIPPET_CHARS = 300;

/**
 * The chat's `searchSources` tool: up to 8 of the artist's stored public
 * sources, those matching the query first (the shared original-text ranking),
 * then the rest. Reads stored text only.
 *
 * @param originals - The artist's stored originals (`loadPublicResearchOriginals`).
 * @param artistName - The artist's name, for ranking.
 * @returns The tool.
 */
export function createSearchSourcesTool(originals: ResearchOriginal[], artistName: string) {
  return tool({
    description:
      "Search the artist's saved sources. Returns up to 8 with a snippet each; read one with readSource before citing it.",
    inputSchema: z.object({ query: z.string().min(1).max(300) }),
    execute: async ({ query }) => {
      const request: ResearchRequest = {
        topic: query,
        evidenceNeed: "reporting",
        freshness: "stored",
        retrieval: "relevance",
      };
      const ranked = selectResearchReferences(originals, request, artistName);
      const seen = new Set<string>();
      const sources = [...ranked, ...getEligibleResearchOriginals(originals, request)]
        .filter(source => !seen.has(source.sourceId) && seen.add(source.sourceId))
        .slice(0, MAX_SOURCES)
        .map(source => ({
          sourceId: source.sourceId,
          title: getSourceTitle(source.url),
          url: source.url,
          snippet: source.text.slice(0, SNIPPET_CHARS),
        }));
      return { sources };
    },
  });
}
