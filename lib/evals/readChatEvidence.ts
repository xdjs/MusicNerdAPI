import { createHash } from "node:crypto";
import type { ChatEvidence } from "@/lib/evals/ChatEvidence";

/** Extract only supported public tool outputs, preserving the exact text the model saw. */
export function readChatEvidence(
  tool: string,
  toolCallId: string,
  output: unknown,
): ChatEvidence[] {
  if (!output || typeof output !== "object") return [];
  const record = output as Record<string, unknown>;
  if (tool !== "readSource" && tool !== "webSearch" && tool !== "readWebSource") return [];
  if (tool === "readWebSource" && record.status !== "ready") return [];
  const isRead = tool === "readSource" || tool === "readWebSource";
  const candidates = isRead ? [record] : Array.isArray(record.results) ? record.results : [];
  return candidates.flatMap(candidate => {
    if (!candidate || typeof candidate !== "object") return [];
    const row = candidate as Record<string, unknown>;
    const text = isRead ? row.text : row.snippet;
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
    return [
      {
        n: row.n,
        url: row.url,
        text,
        tool,
        toolCallId,
        sha256: createHash("sha256").update(text).digest("hex"),
        ...(tool === "readWebSource"
          ? {
              ...(typeof row.sourceId === "string" ? { sourceId: row.sourceId } : {}),
              ...(typeof row.requestedUrl === "string" ? { requestedUrl: row.requestedUrl } : {}),
              ...(typeof row.truncated === "boolean" ? { truncated: row.truncated } : {}),
            }
          : {}),
        ...(isRead
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
