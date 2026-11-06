import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { Worker } from "node:worker_threads";
import { MAX_CHAT_PDF_BYTES, MAX_CHAT_PDF_PAGES, CHAT_PDF_READ_MS } from "./types";

const code = `
const { parentPort, workerData } = require('node:worker_threads');
const { createHash } = require('node:crypto');
const parse = require(workerData.parserPath);
const pages = new Map();
let total = 0;
let invalid = false;
Promise.resolve().then(() => parse(workerData.bytes, {
  max: workerData.maxPages,
  version: 'v1.10.100',
  pagerender: async page => {
    const physicalPage = page.pageNumber;
    if (!Number.isSafeInteger(physicalPage) || physicalPage < 1 || physicalPage > workerData.maxPages || pages.has(physicalPage)) {
      invalid = true; throw new Error('Invalid physical page');
    }
    const content = await page.getTextContent({normalizeWhitespace:false, disableCombineTextItems:false});
    let lastY;
    let text = '';
    for (const item of content.items) {
      if (typeof item.str !== 'string' || !item.str.isWellFormed() || !Array.isArray(item.transform)) {
        invalid = true; throw new Error('Invalid PDF text item');
      }
      if (lastY !== undefined && lastY !== item.transform[5]) text += '\\n';
      text += item.str;
      lastY = item.transform[5];
    }
    total += text.length;
    if (text.length > 24000 || total > 120000) { invalid = true; throw new Error('PDF text limit'); }
    pages.set(physicalPage, {physicalPage, text, sha256:createHash('sha256').update(text).digest('hex')});
    return '';
  }
})).then(result => {
  if (invalid || result.version !== '1.10.100' || !Number.isSafeInteger(result.numpages) || result.numpages < 1 || result.numpages > workerData.maxPages || pages.size !== result.numpages)
    throw new Error('Incomplete page extraction');
  const rows = Array.from(pages.values()).sort((a,b)=>a.physicalPage-b.physicalPage);
  if (rows.some((p,i)=>p.physicalPage!==i+1)) throw new Error('Missing physical page');
  parentPort.postMessage({type:'done', physicalPages:result.numpages, pages:rows});
}).catch(() => parentPort.postMessage({type:'failed'}));
`;

type PdfPageText = { physicalPage: number; text: string; sha256: string };
/** Derive physical-page text only from exactly hash-matching original bytes in a terminable isolate. */
export async function extractOriginalPdfPages(
  bytes: Uint8Array,
  expectedOriginalSha256: string,
  signal: AbortSignal,
  parserPath = createRequire(`${process.cwd()}/package.json`).resolve("pdf-parse/lib/pdf-parse.js"),
): Promise<{
  originalSha256: string;
  extractor: "pdf-parse@1.1.4/pdfjs@1.10.100/pdf-text-items-y-lines-v1";
  physicalPages: number;
  pages: PdfPageText[];
  extraction: {
    engine: "pdf-parse@1.1.4/pdfjs@1.10.100";
    algorithm: "pdf-text-items-y-lines-v1";
    coverage: "all-physical-pages-text-layer";
    emptyTextPages: number[];
    visualTextCompleteness: "unverified";
  };
}> {
  signal = AbortSignal.any([signal, AbortSignal.timeout(CHAT_PDF_READ_MS)]);
  signal.throwIfAborted();
  if (bytes.length > MAX_CHAT_PDF_BYTES || !/^[a-f0-9]{64}$/.test(expectedOriginalSha256))
    throw new Error("PDF original hash mismatch or unsupported bytes");
  const originalBytes = new Uint8Array(bytes);
  const originalSha256 = createHash("sha256").update(originalBytes).digest("hex");
  if (
    !/^[a-f0-9]{64}$/.test(expectedOriginalSha256) ||
    originalSha256 !== expectedOriginalSha256 ||
    originalBytes.length > MAX_CHAT_PDF_BYTES ||
    Buffer.from(originalBytes.subarray(0, 5)).toString() !== "%PDF-"
  )
    throw new Error("PDF original hash mismatch or unsupported bytes");
  const worker = new Worker(code, {
    eval: true,
    workerData: {
      bytes: originalBytes,
      parserPath,
      maxPages: MAX_CHAT_PDF_PAGES,
    },
    resourceLimits: {
      maxOldGenerationSizeMb: 64,
      maxYoungGenerationSizeMb: 16,
      stackSizeMb: 2,
    },
  });
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = async (
      error?: Error,
      result?: { physicalPages: number; pages: PdfPageText[] },
    ) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      await worker.terminate();
      if (error) reject(error);
      else
        resolve({
          originalSha256,
          extractor: "pdf-parse@1.1.4/pdfjs@1.10.100/pdf-text-items-y-lines-v1",
          ...result!,
          extraction: {
            engine: "pdf-parse@1.1.4/pdfjs@1.10.100",
            algorithm: "pdf-text-items-y-lines-v1",
            coverage: "all-physical-pages-text-layer",
            emptyTextPages: result!.pages.filter(p => !p.text.trim()).map(p => p.physicalPage),
            visualTextCompleteness: "unverified",
          },
        });
    };
    const abort = () => void finish(new Error("PDF text extraction cancelled or timed out"));
    worker.on("message", message => {
      if (
        message?.type !== "done" ||
        !Array.isArray(message.pages) ||
        !Number.isSafeInteger(message.physicalPages) ||
        message.physicalPages < 1 ||
        message.pages.length !== message.physicalPages ||
        message.pages.some(
          (p: PdfPageText, i: number) =>
            p.physicalPage !== i + 1 ||
            typeof p.text !== "string" ||
            !p.text.isWellFormed() ||
            createHash("sha256").update(p.text).digest("hex") !== p.sha256,
        )
      )
        void finish(new Error("PDF physical-page extraction unavailable"));
      else void finish(undefined, message);
    });
    worker.once("error", error => void finish(error));
    worker.once("exit", () => {
      if (!settled) void finish(new Error("PDF extraction exited"));
    });
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}
