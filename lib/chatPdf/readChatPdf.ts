import { createHash } from "node:crypto";
import { inspectChatPdf } from "@/lib/chatPdf/inspectChatPdf";
import {
  CHAT_PDF_READ_MS,
  MAX_CHAT_PDF_BYTES,
  MAX_CHAT_PDF_PAGES,
  type ChatPdf,
} from "@/lib/chatPdf/types";

/** Read one authorized public original with a byte/time/page bound; no credentials or extraction writes. */
export async function readChatPdf(source: ChatPdf, signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(CHAT_PDF_READ_MS);
  const bounded = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const response = await fetch(source.url, {
    redirect: "error",
    signal: bounded,
    cache: "no-store",
  });
  if (!response.ok || !response.body) throw new Error("PDF unavailable");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      bounded.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_CHAT_PDF_BYTES || size > source.size)
        throw new Error("PDF exceeds read limit");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = Buffer.concat(chunks);
  if (bytes.length !== source.size || bytes.subarray(0, 5).toString() !== "%PDF-")
    throw new Error("PDF changed or invalid");
  const pages = await inspectChatPdf(bytes, bounded);
  if (pages > MAX_CHAT_PDF_PAGES) throw new Error("PDF exceeds page limit");
  return {
    bytes,
    pages,
    hash: createHash("sha256").update(bytes).digest("hex"),
  };
}
