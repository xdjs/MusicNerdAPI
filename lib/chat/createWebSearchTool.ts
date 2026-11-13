import { tool } from "ai";
import { z } from "zod";
import type { CiteSource } from "@/lib/chat/createChatCitations";
import { webSearch } from "@/lib/search/webSearch";

/**
 * The chat's `webSearch` tool, for questions the saved sources can't answer:
 * the shared Tavily search, each result numbered as a citable source.
 *
 * @param cite - The turn's citation numbering.
 * @param opts.maxCalls - Searches allowed per answer (default 2); later calls return an error without searching.
 * @returns The tool.
 */
export function createWebSearchTool(cite: CiteSource, opts?: { maxCalls?: number }) {
  const maxCalls = opts?.maxCalls ?? 2;
  let calls = 0;
  return tool({
    description: `Search the web when the saved sources can't answer. Include the artist's name in the query. Cite a result as [n]. At most ${maxCalls} web searches per answer.`,
    inputSchema: z.object({ query: z.string().min(1).max(300) }),
    execute: async ({ query }) => {
      if (calls >= maxCalls) return { error: "Web search limit reached for this answer" };
      calls++;
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
