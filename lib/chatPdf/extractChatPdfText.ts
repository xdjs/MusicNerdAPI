import { createRequire } from "node:module";
import { Worker } from "node:worker_threads";
import { MAX_CHAT_PDF_BYTES } from "@/lib/chatPdf/types";

/** The most extracted text handed to the model beside the original; about 50 pages of prose. */
export const MAX_CHAT_PDF_TEXT_CHARS = 60_000;

const code = `
const { parentPort, workerData } = require('node:worker_threads');
const parse = require(workerData.parserPath);
const render = async pageData => {
  const content = await pageData.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false });
  let lastY;
  let text = '';
  for (const item of content.items) {
    text += lastY === item.transform[5] || lastY === undefined ? item.str : '\\n' + item.str;
    lastY = item.transform[5];
  }
  return '\\n[page ' + (pageData.pageNumber ?? '?') + ']\\n' + text;
};
Promise.resolve().then(() => parse(workerData.bytes, { pagerender: render }))
  .then(result => parentPort.postMessage({ type: 'done', text: String(result.text ?? '') }))
  .catch(() => parentPort.postMessage({ type: 'failed' }));
`;

/**
 * The PDF's text with `[page N]` markers, extracted in a terminable isolate the way
 * `inspectChatPdf` counts pages, for the model to read beside the original bytes. Any
 * failure, timeout or cancellation yields an empty string: the original is the evidence,
 * and a read must not fail because its text could not be extracted.
 *
 * @param bytes - The original PDF, already bounded by `readChatPdf`.
 * @param signal - Cancels extraction; the worker is terminated.
 * @param parserPath - Offline test seam, never request input.
 * @returns The marked text, truncated to `MAX_CHAT_PDF_TEXT_CHARS`, or "".
 */
export async function extractChatPdfText(
  bytes: Uint8Array,
  signal: AbortSignal,
  parserPath = createRequire(`${process.cwd()}/package.json`).resolve("pdf-parse/lib/pdf-parse.js"),
): Promise<string> {
  if (signal.aborted || bytes.length > MAX_CHAT_PDF_BYTES) return "";
  const worker = new Worker(code, {
    eval: true,
    workerData: { bytes: new Uint8Array(bytes), parserPath },
    resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 32, stackSizeMb: 4 },
  });
  return new Promise(resolve => {
    let settled = false;
    const finish = async (text: string) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      await worker.terminate();
      resolve(text);
    };
    const abort = () => {
      void finish("");
    };
    worker.on("message", message => {
      if (message?.type === "done" && typeof message.text === "string")
        void finish(message.text.trim().slice(0, MAX_CHAT_PDF_TEXT_CHARS));
      else void finish("");
    });
    worker.once("error", () => void finish(""));
    worker.once("exit", () => {
      if (!settled) void finish("");
    });
    signal.addEventListener("abort", abort, { once: true });
  });
}
