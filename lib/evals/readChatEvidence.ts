import { readPdfChatEvidence } from "./readPdfChatEvidence";
import { captureAllowedBlocks } from "./captureAllowedBlocks";
import { createHash } from "node:crypto";
import type { ChatEvidence } from "@/lib/evals/ChatEvidence";

/** Extract only supported public tool outputs, preserving the exact text the model saw. */
export function readChatEvidence(
  tool: string,
  toolCallId: string,
  output: unknown,
): ChatEvidence[] {
  if (tool === "readPdfSource" || tool === "readNamedPdf")
    return readPdfChatEvidence(tool, toolCallId, output);
  if (!output || typeof output !== "object") return [];
  const record = output as Record<string, unknown>;
  if (tool !== "readSource" && tool !== "webSearch") return [];
  const candidates =
    tool === "readSource" ? [record] : Array.isArray(record.results) ? record.results : [];
  return candidates.flatMap(candidate => {
    if (!candidate || typeof candidate !== "object") return [];
    const row = candidate as Record<string, unknown>;
    const text = tool === "readSource" ? row.text : row.snippet;
    if (
      typeof row.n !== "number" ||
      !Number.isInteger(row.n) ||
      row.n < 1 ||
      typeof row.url !== "string" ||
      !row.url ||
      typeof text !== "string" ||
      !text.trim()
    )
      return [];
    const blocks = Array.isArray(row.blocks) ? row.blocks : row.allowedBlocks;
    return [
      {
        n: row.n,
        url: row.url,
        text,
        tool,
        toolCallId,
        sha256: createHash("sha256").update(text).digest("hex"),
        ...(tool === "readSource"
          ? {
              ...(typeof row.sourceId === "string" ? { sourceId: row.sourceId } : {}),
              ...(typeof row.revision === "string" ? { revision: row.revision } : {}),
              ...(typeof row.readId === "string" ? { readId: row.readId } : {}),
              ...(typeof row.start === "number" ? { start: row.start } : {}),
              ...(typeof row.end === "number" ? { end: row.end } : {}),
              ...(Array.isArray(blocks)
                ? {
                    allowedBlocks: captureAllowedBlocks(blocks),
                  }
                : {}),
            }
          : {}),
        ...(tool === "readSource"
          ? Object.fromEntries(
              ["publishedAt", "activityDate", "retrievedAt"]
                .filter(key => row[key] === null || typeof row[key] === "string")
                .map(key => [key, row[key]]),
            )
          : {}),
      },
    ];
  });
}
