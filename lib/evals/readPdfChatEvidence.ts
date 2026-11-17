import { createHash } from "node:crypto";
import parse from "pdf-parse/lib/pdf-parse.js";
import type { ChatEvidence } from "@/lib/evals/ChatEvidence";
import { MAX_CHAT_PDF_BYTES } from "@/lib/chatPdf/types";
import { renderPdfPageText, type PdfPageData } from "@/lib/units/renderPdfPageText";

/** The shared page renderer, with a physical page marker so `[n, p.N]` citations can be checked. */
async function renderPage(pageData: PdfPageData): Promise<string> {
  return `\n[page ${pageData.pageNumber ?? "?"}]\n${await renderPdfPageText(pageData)}`;
}

/**
 * Evaluator-only evidence for a PDF read: the model saw the original bytes, so the judge
 * gets the same document's extracted text with page markers. The bytes are refetched from
 * the public URL the stream cited and must hash to the `sha256` the tool reported; any
 * mismatch, error output or parser failure yields no evidence, which leaves the turn
 * unscored rather than judged against a different document.
 *
 * @param tool - The tool name from the stream (`readPdfSource` or `readNamedPdf`).
 * @param toolCallId - The stream's tool call id.
 * @param output - The tool's output part (`{ sourceId, n, title, pages, sha256 }`).
 * @param url - The `source-url` the stream emitted for the same `n`.
 * @returns One evidence record, or none.
 */
export async function readPdfChatEvidence(
  tool: string,
  toolCallId: string,
  output: unknown,
  url: string,
): Promise<ChatEvidence[]> {
  if (tool !== "readPdfSource" && tool !== "readNamedPdf") return [];
  if (!output || typeof output !== "object") return [];
  const record = output as Record<string, unknown>;
  if (
    typeof record.n !== "number" ||
    !Number.isInteger(record.n) ||
    record.n < 1 ||
    typeof record.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(record.sha256) ||
    !url
  )
    return [];
  try {
    const response = await fetch(url, { redirect: "error", cache: "no-store" });
    if (!response.ok) return [];
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_CHAT_PDF_BYTES) return [];
    if (createHash("sha256").update(bytes).digest("hex") !== record.sha256) return [];
    const parsed = await parse(bytes, { pagerender: renderPage });
    const text = typeof parsed?.text === "string" ? parsed.text.trim() : "";
    if (!text) return [];
    return [
      {
        n: record.n,
        url,
        text,
        tool,
        toolCallId,
        sha256: createHash("sha256").update(text).digest("hex"),
      },
    ];
  } catch {
    return [];
  }
}
