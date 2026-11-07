import { tool } from "ai";
import { createHash } from "node:crypto";
import { z } from "zod";
import { knowledgeWindow } from "@/lib/knowledge/knowledgeWindow";
import type { CiteSource } from "@/lib/chat/createChatCitations";
import { getSourceTitle } from "@/lib/chat/getSourceTitle";
import type { ResearchOriginal } from "@/lib/questionResearch/types";

/** The most of one source the model reads in a step. */
const MAX_SOURCE_CHARACTERS = 12000;
const locatorSchema = z
  .object({
    sourceId: z.string().min(1).max(300),
    revision: z.string().min(1).max(300),
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
    sha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  })
  .strict();

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
  assertCurrent?: (source: ResearchOriginal) => Promise<void>,
) {
  return tool({
    description:
      "Read a saved source found by searchSources. Pass its locator unchanged when present to include the matching passage and surrounding context. A hash-bound prior passage locator reopens only that verified window; it is not authorization. Without a locator this reads the source prefix. Cite it in the answer as [n].",
    inputSchema: z.object({
      sourceId: z.string().min(1).max(300),
      locator: locatorSchema.optional(),
    }),
    execute: async ({ sourceId, locator }) => {
      const source = originals.find(original => original.sourceId === sourceId);
      if (!source) return { error: "Unknown sourceId. Use an id from searchSources." };
      await assertCurrent?.(source);
      let window: ReturnType<typeof knowledgeWindow> | undefined;
      if (locator !== undefined) {
        const parsed = locatorSchema.safeParse(locator);
        const splitsPair = (offset: number) =>
          offset > 0 &&
          offset < source.text.length &&
          /[\uD800-\uDBFF]/.test(source.text[offset - 1]) &&
          /[\uDC00-\uDFFF]/.test(source.text[offset]);
        if (
          !parsed.success ||
          parsed.data.sourceId !== sourceId ||
          parsed.data.revision !== source.revision ||
          parsed.data.end <= parsed.data.start ||
          parsed.data.end > source.text.length ||
          parsed.data.end - parsed.data.start > MAX_SOURCE_CHARACTERS ||
          (parsed.data.sha256 !== undefined &&
            (parsed.data.end - parsed.data.start > 2400 ||
              createHash("sha256")
                .update(source.text.slice(parsed.data.start, parsed.data.end))
                .digest("hex") !== parsed.data.sha256)) ||
          splitsPair(parsed.data.start) ||
          splitsPair(parsed.data.end)
        )
          return {
            error: "Invalid or stale source locator. Search this source again; no text was read.",
          };
        const { start, end } = parsed.data;
        if (parsed.data.sha256 !== undefined) {
          window = knowledgeWindow(source.text, start, end - start);
        } else {
          const preceding = Math.min(800, MAX_SOURCE_CHARACTERS - (end - start));
          window = knowledgeWindow(
            source.text,
            Math.max(0, start - preceding),
            MAX_SOURCE_CHARACTERS,
          );
          if (window.end < end) window = knowledgeWindow(source.text, start, MAX_SOURCE_CHARACTERS);
        }
      }
      window ??= knowledgeWindow(source.text, 0, MAX_SOURCE_CHARACTERS);
      const title = getSourceTitle(source.url);
      return {
        n: cite({ url: source.url, title }),
        title,
        url: source.url,
        text: window.text,
        sourceId: source.sourceId,
        sha256: createHash("sha256").update(window.text).digest("hex"),
        ...(window
          ? {
              revision: source.revision,
              start: window.start,
              end: window.end,
              truncated: window.start > 0 || window.end < source.text.length,
              sourceTruncated: source.truncated,
            }
          : {}),
        publishedAt: source.publishedAt,
        activityDate: source.activityDate ?? null,
        retrievedAt: source.retrievedAt,
      };
    },
  });
}
