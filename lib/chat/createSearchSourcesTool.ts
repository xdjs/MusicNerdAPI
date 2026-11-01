import { tool } from "ai";
import { z } from "zod";
import { knowledgeWindow } from "@/lib/knowledge/knowledgeWindow";
import { getQuerySnippet } from "@/lib/chat/getQuerySnippet";
import { getSourceTitle } from "@/lib/chat/getSourceTitle";
import { rankChatSourceOriginals } from "./rankChatSourceOriginals";
import { selectResearchReferences } from "@/lib/questionResearch/selectResearchReferences";
import type { ResearchOriginal, ResearchRequest } from "@/lib/questionResearch/types";

const MAX_SOURCES = 8;
const SNIPPET_CHARS = 300;

/**
 * The chat's `searchSources` tool: up to 8 of the artist's stored public
 * sources, those matching the query first (the shared original-text ranking),
 * then the rest, each with a bounded snippet from its winning passage. Reads stored text only.
 *
 * @param originals - The artist's stored originals (`loadPublicResearchOriginals`).
 * @param artistName - The artist's name, for ranking.
 * @returns The tool.
 */
export function createSearchSourcesTool(originals: ResearchOriginal[], artistName: string) {
  return tool({
    description:
      "Search the artist's saved sources. Returns up to 8, each with the passage that best matches the query; read one with readSource before citing it, passing its locator when present. For newest/recent activity use retrieval=latest, and platform when the question names one. Use evidenceNeed=release_date for latest releases. Dates describe stored evidence, not complete live coverage.",
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
      const candidates =
        retrieval === "latest"
          ? selectResearchReferences(originals, request, artistName)
          : rankChatSourceOriginals(originals, request, artistName, MAX_SOURCES);
      const sources = candidates.slice(0, MAX_SOURCES).map(source => {
        const match = "match" in source ? source.match : undefined;
        return {
          sourceId: source.sourceId,
          title: getSourceTitle(source.url),
          url: source.url,
          snippet: match
            ? knowledgeWindow(
                source.text,
                Math.max(match.start, Math.min(match.anchor - 60, match.end - SNIPPET_CHARS)),
                Math.min(SNIPPET_CHARS, match.end - match.start),
              ).text
            : getQuerySnippet(source.text, query, SNIPPET_CHARS),
          ...(match
            ? {
                locator: {
                  sourceId: source.sourceId,
                  revision: source.revision,
                  start: match.start,
                  end: match.end,
                },
              }
            : {}),
          publishedAt: source.publishedAt,
          activityDate: source.activityDate ?? null,
          retrievedAt: source.retrievedAt,
        };
      });
      return {
        sources,
        coverage:
          "Only stored sources were searched; dates do not establish complete live coverage.",
      };
    },
  });
}
