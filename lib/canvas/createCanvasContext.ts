import { tool } from "ai";
import { z } from "zod";
import type { CiteSource } from "@/lib/chat/createChatCitations";
import { createReadSourceTool } from "@/lib/chat/createReadSourceTool";
import { getSourceTitle } from "@/lib/chat/getSourceTitle";
import type { ResearchOriginal } from "@/lib/questionResearch/types";
import {
  canvasSeed as defaultSeed,
  type CanvasEvidence,
  type CanvasRequest,
  type CanvasUpdate,
} from "./const";
import { createCanvasTool } from "./createCanvasTool";
/** Augment the existing chat tools with evidence-bound composition; never accept client facts. */
export function createCanvasContext(
  request: CanvasRequest,
  originals: ResearchOriginal[],
  cite: CiteSource,
  canvasSeed: CanvasEvidence[] = defaultSeed,
) {
  const evidence = new Map<string, CanvasEvidence>(canvasSeed.map(source => [source.id, source]));
  const register = (source: ResearchOriginal) => {
    let url: URL;
    try {
      url = new URL(source.url);
    } catch {
      return;
    }
    if (!["https:", "http:"].includes(url.protocol)) return;
    evidence.set(source.sourceId, {
      id: source.sourceId,
      title: getSourceTitle(source.url),
      url: source.url,
      text: source.text.slice(0, 450),
      category: "source",
      date: source.publishedAt,
      dateKind: "Source published",
      limitation:
        "Exact opening excerpt from a stored public source. Publication date is not an inferred event date.",
    });
  };
  for (const id of request.spec.blocks.flatMap(block => block.items)) {
    const source = originals.find(item => item.sourceId === id);
    if (source) register(source);
  }
  let candidate: CanvasUpdate | undefined;
  const read = createReadSourceTool(originals, cite);
  const readSource = tool({
    description: read.description,
    inputSchema: z.object({ sourceId: z.string().min(1).max(300) }),
    execute: async ({ sourceId }, options) => {
      const seedSource = canvasSeed.find(item => item.id === sourceId);
      if (seedSource)
        return {
          ...seedSource,
          evidenceId: seedSource.id,
          category: seedSource.category,
          n: cite({ url: seedSource.url, title: seedSource.title }),
        };
      const result = await read.execute!({ sourceId }, options);
      const source = originals.find(item => item.sourceId === sourceId);
      if (source) register(source);
      return { ...result, evidenceId: sourceId, category: "source" };
    },
  });
  return {
    readSource,
    composeCanvas: createCanvasTool(request, evidence, update => {
      candidate = update;
    }),
    getUpdate: () => candidate,
    instructions: `\nCANVAS PREVIEW: Use composeCanvas to produce a complete nextSpec, not a fixed page mode. Preserve unrelated/pinned blocks and stable IDs. Use prior conversation, focus and selection. Select and combine blocks. Never invent dates, quotes or relationships. Cards display server-owned evidence; titles are short presentation labels, not new factual claims. Unknown requests can be answered honestly without changing the canvas. Seed evidence is a curated public snapshot, not exhaustive/live. Read more using existing tools. Seed evidence is already available for composition; readSource can also read seed IDs. readSource returns evidenceId: use that exact string in items, NEVER the numeric citation n. quote blocks only accept category=quote; use document/cards for source passages, timeline only when date exists, media only for film/process. Only readSource evidence can be added beyond the seed; webSearch may inform prose but is not a canvas source. Current request: ${JSON.stringify(request)}\nTrusted seed: ${JSON.stringify(canvasSeed)}`,
  };
}
