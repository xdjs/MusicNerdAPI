import { tool, type UIMessageChunk, type UIMessageStreamWriter } from "ai";
import { z } from "zod";
import type { ResearchOriginal } from "@/lib/questionResearch/types";
import type { CiteSource } from "@/lib/chat/createChatCitations";
import { createReadSourceTool } from "@/lib/chat/createReadSourceTool";
import { selectSourceContext } from "@/lib/chat/selectSourceContext";
import { getSourceTitle } from "@/lib/chat/getSourceTitle";

/** A terminal, attributed excerpt response for unresolved saved-source differences.
 * Buffers model text per step so a chosen fallback cannot retain speculative prose
 * from that step. Tool/source events still stream. Selection remains model-driven.
 */
export function createChatConflictFallback(
  originals: ResearchOriginal[],
  cite: CiteSource,
  writer: UIMessageStreamWriter,
) {
  const read = new Map<string, { text: string; truncated: boolean }>();
  let answer: string | null = null;
  let emitted = false;
  const readSource = createReadSourceTool(originals, cite, (id, text, truncated) =>
    read.set(id, { text, truncated }),
  );
  const showSourceDifferences = tool({
    description:
      "Finish this answer with attributed excerpts when two saved sources you read leave a relevant distinction unresolved. Select a unique literal phrase in each source. The server includes surrounding paragraphs/headings and stops generation. Do not invent an explanation. Only successful readSource results from this turn are eligible; not web snippets or PDFs.",
    inputSchema: z
      .object({
        sources: z
          .array(
            z
              .object({ sourceId: z.string().min(1).max(300), anchor: z.string().min(1).max(300) })
              .strict(),
          )
          .length(2),
      })
      .strict(),
    execute: async ({ sources }) => {
      if (answer !== null) return { error: "A source-difference answer is already selected." };
      if (sources[0].sourceId === sources[1].sourceId)
        return { error: "Select two different read sources." };
      const selected = sources.map(({ sourceId, anchor }) => {
        const entry = read.get(sourceId);
        const original = originals.find(s => s.sourceId === sourceId);
        if (!entry || !original) return null;
        const context = selectSourceContext(entry.text, anchor, entry.truncated);
        return context ? { original, context } : null;
      });
      if (selected.some(s => !s))
        return {
          error:
            "Select unique phrases within complete, bounded passages from sources read this turn.",
        };
      const excerpts = selected.map(s => {
        const { original, context } = s!;
        const n = cite({ url: original.url, title: getSourceTitle(original.url) });
        // Web renders plain text with [n] citation parsing. Full-width brackets
        // preserve literal source markers without creating synthetic citations.
        const literal = context.replace(/\[/g, "［").replace(/\]/g, "］");
        return `Source [${n}]:\n“${literal}”`;
      });
      answer =
        "Here is what the sources say. I can’t resolve the distinction from these passages.\n\n" +
        excerpts.join("\n\n");
      return { status: "answer_selected" };
    },
  });
  const guardedWriter: UIMessageStreamWriter = {
    ...writer,
    merge(stream) {
      let pending: UIMessageChunk[] = [];
      let hasTool = false;
      let failed = false;
      const flush = (controller: TransformStreamDefaultController<UIMessageChunk>) => {
        if (failed) {
          pending = [];
          return;
        }
        if (answer !== null) {
          if (!emitted) {
            emitted = true;
            controller.enqueue({ type: "text-start", id: "source-differences" });
            controller.enqueue({ type: "text-delta", id: "source-differences", delta: answer });
            controller.enqueue({ type: "text-end", id: "source-differences" });
          }
        } else if (!hasTool) for (const chunk of pending) controller.enqueue(chunk);
        pending = [];
        hasTool = false;
      };
      writer.merge(
        stream.pipeThrough(
          new TransformStream<UIMessageChunk, UIMessageChunk>({
            transform(chunk, controller) {
              if (chunk.type === "error" || chunk.type === "abort") {
                failed = true;
                pending = [];
              }
              if (chunk.type.startsWith("tool-")) hasTool = true;
              if (
                chunk.type === "text-start" ||
                chunk.type === "text-delta" ||
                chunk.type === "text-end"
              ) {
                pending.push(chunk);
                return;
              }
              if (chunk.type === "finish-step" || chunk.type === "finish") flush(controller);
              controller.enqueue(chunk);
            },
            flush,
          }),
        ),
      );
    },
  };
  return { readSource, showSourceDifferences, writer: guardedWriter, stop: () => answer !== null };
}
