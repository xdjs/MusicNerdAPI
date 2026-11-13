import { createHash } from "node:crypto";
import { extractPdfPages } from "@/lib/units/extractPdfPages";
import { isBrokenExtraction } from "@/lib/units/isBrokenExtraction";
import { readPageWithVision } from "@/lib/units/readPageWithVision";
import { slicePdfPage } from "@/lib/units/slicePdfPage";
import { splitTextUnits } from "@/lib/units/splitTextUnits";
import { MAX_INGEST_PAGES, MAX_PAGE_CHARS } from "@/lib/units/types";
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
 * is broken or empty is read with vision and marked `ocr`. A page that cannot be read
 * (vision throws) or is still empty afterwards is skipped, so `unitIndex` stays dense.
 *
 * @param input - The source and its body.
 * @param deps - `readPage` overrides the vision read; `signal` is passed to it.
 * @returns The drafts, the count of vision-read pages, `failed` when a vision read
 * threw ("vision") or the PDF could not be parsed ("extract", with no units; this
 * function does not rethrow), and whether the PDF was cut at the page limit.
 */
export async function buildSourceUnits(
  input: UnitSourceInput,
  deps: { readPage?: (pageBytes: Uint8Array) => Promise<string>; signal?: AbortSignal } = {},
): Promise<{
  units: UnitDraft[];
  ocrPages: number;
  failed?: "vision" | "extract";
  truncated: boolean;
}> {
  const body = input.body;
  if (body.kind === "none") return { units: [], ocrPages: 0, truncated: false };

  if (body.kind !== "pdf") {
    const units = splitTextUnits(body.text, body.kind).map((u, i) =>
      draft(i, u.locator, u.text, false),
    );
    return { units, ocrPages: 0, truncated: false };
  }

  let extracted: { pages: string[]; truncated: boolean };
  try {
    extracted = await extractPdfPages(body.bytes, { maxPages: MAX_INGEST_PAGES });
  } catch {
    return { units: [], ocrPages: 0, failed: "extract", truncated: false };
  }

  const readPage =
    deps.readPage ??
    ((pageBytes: Uint8Array) => readPageWithVision(pageBytes, { signal: deps.signal }));
  const units: UnitDraft[] = [];
  let ocrPages = 0;
  let failed: "vision" | undefined;

  for (let i = 0; i < extracted.pages.length; i++) {
    let text = extracted.pages[i];
    let ocr = false;
    if (isBrokenExtraction(text)) {
      try {
        text = (await readPage(await slicePdfPage(body.bytes, i))).trim();
      } catch {
        failed = "vision";
        continue;
      }
      ocr = true;
    }
    text = text.slice(0, MAX_PAGE_CHARS);
    if (!text) continue;
    if (ocr) ocrPages++;
    units.push(draft(units.length, `p.${i + 1}`, text, ocr));
  }

  return { units, ocrPages, ...(failed ? { failed } : {}), truncated: extracted.truncated };
}
