import { tool } from "ai";
import { z } from "zod";
import type { CiteSource } from "@/lib/chat/createChatCitations";
import { webSearch } from "@/lib/search/webSearch";

/**
 * The chat's `webSearch` tool, for questions the saved sources can't answer:
 * the shared Tavily search, each result numbered as a citable source.
 *
 * @param cite - The turn's citation numbering.
 * @returns The tool.
 */
export function createWebSearchTool(cite: CiteSource) {
  return tool({
    description:
      "Search the web when the saved sources can't answer. Include the artist's name in the query. Cite a result as [n].",
    inputSchema: z.object({ query: z.string().min(1).max(300) }),
    execute: async ({ query }) => {
      const results = await webSearch(query);
      return {
        results: results.map(({ url, title, snippet }) => ({
          n: cite({ url, title }),
          title,
          url,
          snippet,
        })),
      };
    },
  });
}
