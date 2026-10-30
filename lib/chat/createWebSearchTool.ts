import { tool } from "ai";
import { z } from "zod";
import type { CiteSource } from "@/lib/chat/createChatCitations";
import { webSearch } from "@/lib/search/webSearch";
import type { WebSearchResult } from "@/lib/search/types";

/**
 * The chat's `webSearch` tool, for questions the saved sources can't answer:
 * the shared Tavily search, each result numbered as a citable source.
 *
 * @param cite - The turn's citation numbering.
 * @param register - Optional turn-local reader registration; undefined rejects a result.
 * @returns The tool.
 */
export function createWebSearchTool(
  cite: CiteSource,
  register?: (source: WebSearchResult) => string | undefined,
) {
  return tool({
    description:
      "Search the web when the saved sources can't answer. Include the artist's name in the query. Cite a result as [n].",
    inputSchema: z.object({ query: z.string().min(1).max(300) }),
    execute: async ({ query }) => {
      const results = await webSearch(query);
      return {
        results: results.flatMap(source => {
          const sourceId = register?.(source);
          if (register && !sourceId) return [];
          const { url, title, snippet } = source;
          return [
            { n: cite({ url, title }), title, url, snippet, ...(sourceId ? { sourceId } : {}) },
          ];
        }),
      };
    },
  });
}
