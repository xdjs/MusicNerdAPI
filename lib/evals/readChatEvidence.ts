import { createHash } from "node:crypto";
import type { ChatEvidence } from "@/lib/evals/ChatEvidence";

/** The document a passage tool numbered: its public URL, or `musicnerd://kind/id` when it has none. */
function documentUrl(documents: unknown, n: number): string | undefined {
  if (!Array.isArray(documents)) return undefined;
  const doc = documents.find(d => d && typeof d === "object" && (d as { n?: unknown }).n === n) as
    Record<string, unknown> | undefined;
  if (!doc) return undefined;
  if (typeof doc.url === "string" && doc.url) return doc.url;
  return typeof doc.sourceKind === "string" && typeof doc.sourceId === "string"
    ? `musicnerd://${doc.sourceKind}/${doc.sourceId}`
    : undefined;
}

/** One row per passage or unit the model saw, its locator first so `[n, p.N]` can be checked. */
function readPassageEvidence(
  tool: "searchPassages" | "readUnits",
  toolCallId: string,
  record: Record<string, unknown>,
): ChatEvidence[] {
  const items: { n: unknown; locator: unknown; text: unknown }[] =
    tool === "searchPassages"
      ? (Array.isArray(record.results) ? record.results : []).map((r: Record<string, unknown>) => ({
          n: r?.n,
          locator: r?.locator,
          text: r?.passage,
        }))
      : (Array.isArray(record.units) ? record.units : []).map((u: Record<string, unknown>) => ({
          n: record.n,
          locator: u?.locator,
          text: u?.text,
        }));
  return items.flatMap(({ n, locator, text }) => {
    if (typeof n !== "number" || !Number.isInteger(n) || n < 1) return [];
    if (typeof locator !== "string" || typeof text !== "string" || !text.trim()) return [];
    const url = documentUrl(record.documents, n);
    if (!url) return [];
    const marked = `[${locator}]\n${text}`;
    return [
      {
        n,
        url,
        text: marked,
        tool,
        toolCallId,
        sha256: createHash("sha256").update(marked).digest("hex"),
      },
    ];
  });
}

/** Extract only supported public tool outputs, preserving the exact text the model saw. */
export function readChatEvidence(
  tool: string,
  toolCallId: string,
  output: unknown,
): ChatEvidence[] {
  if (!output || typeof output !== "object") return [];
  const record = output as Record<string, unknown>;
  if (tool === "searchPassages" || tool === "readUnits")
    return readPassageEvidence(tool, toolCallId, record);
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
    return [
      {
        n: row.n,
        url: row.url,
        text,
        tool,
        toolCallId,
        sha256: createHash("sha256").update(text).digest("hex"),
      },
    ];
  });
}
