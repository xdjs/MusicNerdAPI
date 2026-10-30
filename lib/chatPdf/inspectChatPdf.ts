import { createRequire } from "node:module";
import { Worker } from "node:worker_threads";
import parserEntry from "pdf-parse/lib/pdf-parse.js";
import { MAX_CHAT_PDF_BYTES } from "@/lib/chatPdf/types";

const code = `
const { parentPort, workerData } = require('node:worker_threads');
const parse = require(workerData.parserPath);
Promise.resolve().then(() => parse(workerData.bytes, { max: 1, pagerender: async () => '' }))
  .then(result => parentPort.postMessage({ type: 'done', pages: result.numpages }))
  .catch(() => parentPort.postMessage({ type: 'failed' }));
`;

/** Inspect in a terminable isolate; optional parser path is an offline test seam, never request input. */
export async function inspectChatPdf(
  bytes: Uint8Array,
  signal: AbortSignal,
  parserPath = createRequire(`${process.cwd()}/package.json`).resolve("pdf-parse/lib/pdf-parse.js"),
): Promise<number> {
  // Keep the existing parser dependency in deployment traces; parsing runs only in the worker.
  if (typeof parserEntry !== "function") throw new Error("PDF parser unavailable");
  signal.throwIfAborted();
  if (bytes.length > MAX_CHAT_PDF_BYTES) throw new Error("PDF exceeds read limit");
  const worker = new Worker(code, {
    eval: true,
    workerData: { bytes: new Uint8Array(bytes), parserPath },
    resourceLimits: { maxOldGenerationSizeMb: 64, maxYoungGenerationSizeMb: 16, stackSizeMb: 2 },
  });
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = async (error?: Error, pages?: number) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      // Do not resolve/reject until synchronous parsing can no longer consume resources.
      await worker.terminate();
      if (error) reject(error);
      else resolve(pages!);
    };
    const abort = () => {
      void finish(new Error("PDF inspection cancelled or timed out"));
    };
    worker.on("message", message => {
      if (message?.type === "done") {
        if (!Number.isInteger(message.pages) || message.pages < 1)
          void finish(new Error("Invalid PDF page count"));
        else void finish(undefined, message.pages);
      } else if (message?.type === "failed") void finish(new Error("PDF inspection failed"));
    });
    worker.once("error", error => {
      void finish(error);
    });
    worker.once("exit", () => {
      if (!settled) void finish(new Error("PDF inspection exited"));
    });
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}
