import { tool } from "ai";
import { z } from "zod";
import type { CiteSource } from "@/lib/chat/createChatCitations";
import { getSourceTitle } from "@/lib/chat/getSourceTitle";
import type { ResearchOriginal } from "@/lib/questionResearch/types";

/** The most of one source the model reads in a step. */
const MAX_SOURCE_CHARACTERS = 12000;

/**
 * The chat's `readSource` tool: one stored source's text and its citation
 * number. The first read of a source writes its `source-url` part. Reads
 * stored text only; the page is never fetched.
 *
 * @param originals - The artist's stored originals (`loadPublicResearchOriginals`).
 * @param cite - The turn's citation numbering.
 * @returns The tool.
 */
export function createReadSourceTool(
  originals: ResearchOriginal[],
  cite: CiteSource,
  onRead?: (id: string, text: string, truncated: boolean) => void,
) {
  return tool({
    description: "Read a saved source found by searchSources. Cite it in the answer as [n].",
    inputSchema: z.object({ sourceId: z.string().min(1).max(300) }),
    execute: async ({ sourceId }) => {
      const source = originals.find(original => original.sourceId === sourceId);
      if (!source) return { error: "Unknown sourceId. Use an id from searchSources." };
      const title = getSourceTitle(source.url);
      onRead?.(
        sourceId,
        source.text.slice(0, MAX_SOURCE_CHARACTERS),
        source.text.length > MAX_SOURCE_CHARACTERS,
      );
      return {
        n: cite({ url: source.url, title }),
        title,
        url: source.url,
        text: source.text.slice(0, MAX_SOURCE_CHARACTERS),
        publishedAt: source.publishedAt,
        activityDate: source.activityDate ?? null,
        retrievedAt: source.retrievedAt,
      };
    },
  });
}
