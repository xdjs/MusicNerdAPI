import { createHash } from "node:crypto";
import { extractPdfPages } from "@/lib/units/extractPdfPages";
import { isBrokenExtraction } from "@/lib/units/isBrokenExtraction";
import { readPageWithVision } from "@/lib/units/readPageWithVision";
import { loadPdfDocument } from "@/lib/units/loadPdfDocument";
import { sliceLoadedPdfPage } from "@/lib/units/sliceLoadedPdfPage";
import { splitTextUnits } from "@/lib/units/splitTextUnits";
import {
  MAX_INGEST_PAGES,
  MAX_OCR_PAGES,
  MAX_PAGE_CHARS,
  OCR_CONCURRENCY,
} from "@/lib/units/types";
import type { UnitDraft, UnitSourceInput } from "@/lib/units/types";

function draft(unitIndex: number, locator: string, text: string, ocr: boolean): UnitDraft {
  return {
    unitIndex,
    locator,
    text,
    textHash: createHash("sha256").update(text).digest("hex"),
    tokens: Math.ceil(text.length / 4),
    ocr,
  };
}

/**
 * Turn one source's body into unit drafts for the page-level text index.
 *
 * PDFs yield one unit per physical page (locator `p.N`); a page whose extracted text
 * is broken or empty is read with vision and marked `ocr`. The document is parsed once; each page
 * for vision is cut from it when a worker takes it, `OCR_CONCURRENCY` at a time; drafts keep page order. A page that
 * cannot be read (vision throws, the per-document vision cap is reached) or is still empty afterwards is skipped, so `unitIndex` stays dense.
 * An empty vision read is a blank page: no draft, no failure, and not counted in `ocrPages`.
 *
 * @param input - The source and its body.
 * @param deps - `ocr: false` skips vision and reports `needsOcr`; `readPage` overrides the vision read; `signal` is passed to it and to the parse; `pdfTimeoutMs` bounds the PDF parse.
 * @returns The drafts, the count of vision-read pages, `failed` when a vision read
 * threw ("vision") or the PDF could not be parsed ("extract", with no units; this
 * function does not rethrow), whether the PDF was cut at the page limit, and `aborted` when the
 * signal cut the parse or the vision reads short (no further read is started; also sets `failed`).
 */
export async function buildSourceUnits(
  input: UnitSourceInput,
  deps: {
    readPage?: (pageBytes: Uint8Array) => Promise<string>;
    signal?: AbortSignal;
    pdfTimeoutMs?: number;
    ocr?: boolean;
  } = {},
): Promise<{
  units: UnitDraft[];
  ocrPages: number;
  failed?: "vision" | "extract";
  truncated: boolean;
  needsOcr: boolean;
  aborted: boolean;
}> {
  const body = input.body;
  if (body.kind === "none")
    return { units: [], ocrPages: 0, truncated: false, needsOcr: false, aborted: false };

  if (body.kind !== "pdf") {
    const units = splitTextUnits(body.text, body.kind).map((u, i) =>
      draft(i, u.locator, u.text, false),
    );
    return { units, ocrPages: 0, truncated: false, needsOcr: false, aborted: false };
  }

  let extracted: { pages: string[]; truncated: boolean };
  try {
    extracted = await extractPdfPages(body.bytes, {
      maxPages: MAX_INGEST_PAGES,
      timeoutMs: deps.pdfTimeoutMs,
      signal: deps.signal,
    });
  } catch {
    return {
      units: [],
      ocrPages: 0,
      failed: "extract",
      truncated: false,
      needsOcr: false,
      aborted: deps.signal?.aborted === true,
    };
  }

  const readPage =
    deps.readPage ??
    ((pageBytes: Uint8Array) => readPageWithVision(pageBytes, { signal: deps.signal }));
  let failed: "vision" | undefined;
  let needsOcr = false;

  // Which pages go to vision, in page order, up to the per-document cap.
  const visionPages: number[] = [];
  for (const [i, text] of extracted.pages.entries()) {
    if (!isBrokenExtraction(text)) continue;
    if (deps.ocr === false) needsOcr = true;
    else if (visionPages.length >= MAX_OCR_PAGES) failed = "vision";
    else visionPages.push(i);
  }

  const read = new Map<number, string>();
  let aborted = false;
  if (visionPages.length > 0) {
    // One parse for the whole document; each slice is cut only when a worker takes its page and
    // dropped after its read, so at most `OCR_CONCURRENCY` slices exist at once.
    let doc: Awaited<ReturnType<typeof loadPdfDocument>> | null = null;
    try {
      doc = await loadPdfDocument(body.bytes, deps.signal);
    } catch {
      failed = "vision";
      if (deps.signal?.aborted) aborted = true;
    }
    // A small pool: each worker takes the next page until none is left or the signal aborts.
    let next = 0;
    const worker = async (source: NonNullable<typeof doc>) => {
      while (next < visionPages.length) {
        if (deps.signal?.aborted) {
          aborted = true;
          return;
        }
        const pageIndex = visionPages[next++];
        try {
          const slice = await sliceLoadedPdfPage(source, pageIndex);
          // Cutting the slice yields: check again so no paid read starts after an abort.
          if (deps.signal?.aborted) {
            aborted = true;
            return;
          }
          read.set(pageIndex, (await readPage(slice)).trim());
        } catch {
          failed = "vision";
          if (deps.signal?.aborted) aborted = true;
        }
      }
    };
    const loaded = doc;
    if (loaded)
      await Promise.all(
        Array.from({ length: Math.min(OCR_CONCURRENCY, visionPages.length) }, () => worker(loaded)),
      );
    if (aborted) failed = "vision";
  }

  const units: UnitDraft[] = [];
  let ocrPages = 0;
  for (const [i, page] of extracted.pages.entries()) {
    const ocr = isBrokenExtraction(page);
    // A broken page with no read (not sent, failed, or cut short) is skipped.
    const text = (ocr ? (read.get(i) ?? "") : page).slice(0, MAX_PAGE_CHARS);
    if (!text) continue;
    if (ocr) ocrPages++;
    units.push(draft(units.length, `p.${i + 1}`, text, ocr));
  }

  return {
    units,
    ocrPages,
    ...(failed ? { failed } : {}),
    truncated: extracted.truncated,
    needsOcr,
    aborted,
  };
}
