import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, test, vi } from "vitest";
import { buildSourceUnits } from "@/lib/units/buildSourceUnits";
import type { UnitBody, UnitSourceInput } from "@/lib/units/types";

async function twoPagePdf(texts: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const text of texts) {
    const page = doc.addPage();
    if (text) page.drawText(text, { x: 50, y: 700, size: 18, font });
  }
  return await doc.save();
}

const PAGE_ONE = "Alpha one is a page of ordinary readable prose about the band and its records.";
const PAGE_TWO = "Beta two is another page of ordinary readable prose about touring and labels.";

function input(body: UnitBody): UnitSourceInput {
  return {
    sourceKind: "vault",
    sourceId: "src-1",
    artistId: "artist-1",
    title: "Doc",
    url: null,
    sourceRevision: "rev-1",
    extractedTextIsNull: false,
    body,
  };
}

describe("buildSourceUnits", () => {
  test("pdf pages become p.N units", async () => {
    const bytes = await twoPagePdf([PAGE_ONE, PAGE_TWO]);
    const readPage = vi.fn();
    const result = await buildSourceUnits(input({ kind: "pdf", bytes }), { readPage });
    expect(result.units.map(u => u.locator)).toEqual(["p.1", "p.2"]);
    expect(result.units.map(u => u.unitIndex)).toEqual([0, 1]);
    expect(result.units.map(u => u.ocr)).toEqual([false, false]);
    expect(result.units[0].text).toContain("Alpha one");
    expect(result.ocrPages).toBe(0);
    expect(result.truncated).toBe(false);
    expect(result.failed).toBeUndefined();
    expect(readPage).not.toHaveBeenCalled();
  });

  test("with ocr off a blank page is skipped, never read, and flagged", async () => {
    const bytes = await twoPagePdf([PAGE_ONE, ""]);
    const readPage = vi.fn();
    const result = await buildSourceUnits(input({ kind: "pdf", bytes }), { readPage, ocr: false });
    expect(readPage).not.toHaveBeenCalled();
    expect(result.units).toHaveLength(1);
    expect(result.needsOcr).toBe(true);
  });

  test("needsOcr is false when every page has text", async () => {
    const bytes = await twoPagePdf([PAGE_ONE, PAGE_TWO]);
    const result = await buildSourceUnits(input({ kind: "pdf", bytes }), { ocr: false });
    expect(result.needsOcr).toBe(false);
  });

  test("an empty page is read by the vision pass", async () => {
    const bytes = await twoPagePdf([PAGE_ONE, ""]);
    const readPage = vi.fn().mockResolvedValue("Text read from the scanned page");
    const signal = new AbortController().signal;
    const result = await buildSourceUnits(input({ kind: "pdf", bytes }), { readPage, signal });
    expect(readPage).toHaveBeenCalledTimes(1);
    expect(result.units).toHaveLength(2);
    expect(result.units[1]).toMatchObject({
      locator: "p.2",
      unitIndex: 1,
      text: "Text read from the scanned page",
      ocr: true,
    });
    expect(result.units[0].ocr).toBe(false);
    expect(result.ocrPages).toBe(1);
  });

  test("a vision failure skips the page and reports it", async () => {
    const bytes = await twoPagePdf([PAGE_ONE, ""]);
    const readPage = vi.fn().mockRejectedValue(new Error("vision down"));
    const result = await buildSourceUnits(input({ kind: "pdf", bytes }), { readPage });
    expect(result.units).toHaveLength(1);
    expect(result.units[0].locator).toBe("p.1");
    expect(result.failed).toBe("vision");
    expect(result.ocrPages).toBe(0);
  });

  test("unit indices stay dense after a skipped page", async () => {
    const bytes = await twoPagePdf(["", PAGE_TWO]);
    const readPage = vi.fn().mockRejectedValue(new Error("vision down"));
    const result = await buildSourceUnits(input({ kind: "pdf", bytes }), { readPage });
    expect(result.units.map(u => [u.locator, u.unitIndex])).toEqual([["p.2", 0]]);
    expect(result.failed).toBe("vision");
  });

  test("a page that is empty after the vision pass produces no draft", async () => {
    const bytes = await twoPagePdf([PAGE_ONE, ""]);
    const readPage = vi.fn().mockResolvedValue("   ");
    const result = await buildSourceUnits(input({ kind: "pdf", bytes }), { readPage });
    expect(result.units).toHaveLength(1);
    expect(result.failed).toBeUndefined();
  });

  test("a page over the page cap is cut there", async () => {
    const bytes = await twoPagePdf([PAGE_ONE, ""]);
    const readPage = vi.fn().mockResolvedValue("x".repeat(30000));
    const result = await buildSourceUnits(input({ kind: "pdf", bytes }), { readPage });
    expect(result.units[1].text).toHaveLength(24000);
  });

  test("an unparseable pdf reports extract and returns no units", async () => {
    const result = await buildSourceUnits(input({ kind: "pdf", bytes: new Uint8Array([1, 2, 3]) }));
    expect(result).toMatchObject({ units: [], failed: "extract", ocrPages: 0, truncated: false });
  });

  test("a document with 61 broken pages sends exactly 60 to vision", async () => {
    const bytes = await twoPagePdf(Array.from({ length: 61 }, () => ""));
    const readPage = vi.fn().mockResolvedValue("Read text");
    const result = await buildSourceUnits(input({ kind: "pdf", bytes }), { readPage });
    expect(readPage).toHaveBeenCalledTimes(60);
    expect(result.units).toHaveLength(60);
    expect(result.ocrPages).toBe(60);
    expect(result.failed).toBe("vision");
  });

  test("an already-aborted signal stops before any vision call", async () => {
    const bytes = await twoPagePdf([PAGE_ONE, ""]);
    const readPage = vi.fn().mockResolvedValue("never");
    const controller = new AbortController();
    controller.abort();
    const result = await buildSourceUnits(input({ kind: "pdf", bytes }), {
      readPage,
      signal: controller.signal,
    });
    expect(readPage).not.toHaveBeenCalled();
    expect(result.units).toEqual([]);
    // The parse itself is bound to the signal.
    expect(result.failed).toBe("extract");
    expect(result.aborted).toBe(true);
  });

  test("an abort mid-document keeps the pages built so far and stops", async () => {
    const bytes = await twoPagePdf([PAGE_ONE, "", ""]);
    const controller = new AbortController();
    const readPage = vi.fn().mockImplementation(async () => {
      controller.abort();
      return "Page two read";
    });
    const result = await buildSourceUnits(input({ kind: "pdf", bytes }), {
      readPage,
      signal: controller.signal,
    });
    expect(readPage).toHaveBeenCalledTimes(1);
    expect(result.units.map(u => u.locator)).toEqual(["p.1", "p.2"]);
    expect(result.failed).toBe("vision");
    expect(result.aborted).toBe(true);
  });

  test("a read that fails because the signal aborted reports aborted", async () => {
    const bytes = await twoPagePdf([PAGE_ONE, ""]);
    const controller = new AbortController();
    const readPage = vi.fn().mockImplementation(async () => {
      controller.abort();
      throw new DOMException("aborted", "AbortError");
    });
    const result = await buildSourceUnits(input({ kind: "pdf", bytes }), {
      readPage,
      signal: controller.signal,
    });
    expect(result).toMatchObject({ failed: "vision", aborted: true });
  });

  test("a finished read is not aborted, even when a page failed", async () => {
    const bytes = await twoPagePdf([PAGE_ONE, ""]);
    const readPage = vi.fn().mockRejectedValue(new Error("vision down"));
    const result = await buildSourceUnits(input({ kind: "pdf", bytes }), {
      readPage,
      signal: new AbortController().signal,
    });
    expect(result).toMatchObject({ failed: "vision", aborted: false });
  });

  test("reads at most four pages at once and keeps drafts in page order", async () => {
    const bytes = await twoPagePdf(Array.from({ length: 10 }, () => ""));
    let inFlight = 0;
    let peak = 0;
    let calls = 0;
    const readPage = vi.fn(async () => {
      const n = ++calls;
      inFlight++;
      peak = Math.max(peak, inFlight);
      // Later pages finish first.
      await new Promise(resolve => setTimeout(resolve, (11 - n) * 3));
      inFlight--;
      return `Page read ${n}`;
    });
    const result = await buildSourceUnits(input({ kind: "pdf", bytes }), { readPage });
    expect(readPage).toHaveBeenCalledTimes(10);
    expect(peak).toBe(4);
    expect(result.units.map(u => [u.unitIndex, u.locator, u.text])).toEqual(
      Array.from({ length: 10 }, (_, i) => [i, `p.${i + 1}`, `Page read ${i + 1}`]),
    );
    expect(result.ocrPages).toBe(10);
    expect(result.aborted).toBe(false);
  });

  test("an abort while four reads are in flight starts no more and keeps the finished ones", async () => {
    const bytes = await twoPagePdf(Array.from({ length: 10 }, () => ""));
    const controller = new AbortController();
    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    const readPage = vi.fn(async () => {
      await gate;
      return "Read before the abort";
    });
    const built = buildSourceUnits(input({ kind: "pdf", bytes }), {
      readPage,
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(readPage).toHaveBeenCalledTimes(4));
    controller.abort();
    release();
    const result = await built;
    expect(readPage).toHaveBeenCalledTimes(4);
    expect(result.units.map(u => u.locator)).toEqual(["p.1", "p.2", "p.3", "p.4"]);
    expect(result).toMatchObject({ failed: "vision", aborted: true, ocrPages: 4 });
  });

  test("parses the document once and cuts each slice only when a worker takes its page", async () => {
    vi.resetModules();
    const doc = { parsed: true };
    const loadPdfDocument = vi.fn().mockResolvedValue(doc);
    const sliceLoadedPdfPage = vi
      .fn()
      .mockImplementation(async (_d: unknown, i: number) => new Uint8Array([i]));
    vi.doMock("@/lib/units/loadPdfDocument", () => ({ loadPdfDocument }));
    vi.doMock("@/lib/units/sliceLoadedPdfPage", () => ({ sliceLoadedPdfPage }));
    const { buildSourceUnits: build } = await import("@/lib/units/buildSourceUnits");
    const bytes = await twoPagePdf([PAGE_ONE, ...Array.from({ length: 9 }, () => "")]);
    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    const readPage = vi.fn(async (page: Uint8Array) => {
      await gate;
      return `Read page index ${page[0]}`;
    });
    const signal = new AbortController().signal;
    const built = build(input({ kind: "pdf", bytes }), { readPage, signal });
    await vi.waitFor(() => expect(readPage).toHaveBeenCalledTimes(4));
    // Four reads in flight: only their four slices exist yet.
    expect(sliceLoadedPdfPage).toHaveBeenCalledTimes(4);
    release();
    const result = await built;
    expect(loadPdfDocument).toHaveBeenCalledOnce();
    expect(loadPdfDocument).toHaveBeenCalledWith(bytes, signal);
    expect(sliceLoadedPdfPage.mock.calls.map(c => [c[0], c[1]])).toEqual(
      Array.from({ length: 9 }, (_, i) => [doc, i + 1]),
    );
    expect(result.units.map(u => u.text).slice(1)).toEqual(
      Array.from({ length: 9 }, (_, i) => `Read page index ${i + 1}`),
    );
    vi.doUnmock("@/lib/units/loadPdfDocument");
    vi.doUnmock("@/lib/units/sliceLoadedPdfPage");
    vi.resetModules();
  });

  test("a document pdf-lib cannot parse fails its vision pages and keeps its text pages", async () => {
    vi.resetModules();
    const loadPdfDocument = vi.fn().mockRejectedValue(new Error("unparseable"));
    vi.doMock("@/lib/units/loadPdfDocument", () => ({ loadPdfDocument }));
    const { buildSourceUnits: build } = await import("@/lib/units/buildSourceUnits");
    const readPage = vi.fn();
    const result = await build(input({ kind: "pdf", bytes: await twoPagePdf([PAGE_ONE, ""]) }), {
      readPage,
    });
    expect(readPage).not.toHaveBeenCalled();
    expect(result.units.map(u => u.locator)).toEqual(["p.1"]);
    expect(result).toMatchObject({ failed: "vision", aborted: false });
    vi.doUnmock("@/lib/units/loadPdfDocument");
    vi.resetModules();
  });

  test("markdown bodies use section locators", async () => {
    const text = "# Intro\nHello there.\n\n# Tour\nWe toured.";
    const result = await buildSourceUnits(input({ kind: "markdown", text }));
    expect(result.units.length).toBeGreaterThan(0);
    expect(result.units.every(u => !u.ocr && !u.locator.startsWith("p."))).toBe(true);
    expect(result.units.map(u => u.unitIndex)).toEqual(result.units.map((_, i) => i));
    expect(result.truncated).toBe(false);
    expect(result.ocrPages).toBe(0);
  });

  test("a none body yields no units", async () => {
    const result = await buildSourceUnits(input({ kind: "none" }));
    expect(result).toEqual({
      units: [],
      ocrPages: 0,
      truncated: false,
      needsOcr: false,
      aborted: false,
    });
  });

  test("hash and token count are set", async () => {
    const result = await buildSourceUnits(input({ kind: "plain", text: "Some plain words here." }));
    const unit = result.units[0];
    expect(unit.textHash).toBe(createHash("sha256").update(unit.text).digest("hex"));
    expect(unit.tokens).toBe(Math.ceil(unit.text.length / 4));
  });

  test("by default a page is read with readPageWithVision and the signal", async () => {
    vi.resetModules();
    const readPageWithVision = vi.fn().mockResolvedValue("");
    vi.doMock("@/lib/units/readPageWithVision", () => ({ readPageWithVision }));
    const { buildSourceUnits: build } = await import("@/lib/units/buildSourceUnits");
    const bytes = await twoPagePdf([PAGE_ONE, ""]);
    const signal = new AbortController().signal;
    const result = await build(input({ kind: "pdf", bytes }), { signal });
    expect(readPageWithVision).toHaveBeenCalledWith(expect.any(Uint8Array), { signal });
    // An empty read is a blank page: no draft, no failure, not an OCR page.
    expect(result.units.map(u => u.locator)).toEqual(["p.1"]);
    expect(result.failed).toBeUndefined();
    expect(result.ocrPages).toBe(0);
    vi.doUnmock("@/lib/units/readPageWithVision");
    vi.resetModules();
  });

  test("a page the model marks blank is neither a unit nor a failure", async () => {
    vi.resetModules();
    const generateText = vi.fn().mockResolvedValue({ text: "[blank page]" });
    vi.doMock("@/lib/ai/generateText", () => ({ generateText }));
    const { buildSourceUnits: build } = await import("@/lib/units/buildSourceUnits");
    const bytes = await twoPagePdf([PAGE_ONE, ""]);
    const result = await build(input({ kind: "pdf", bytes }));
    expect(generateText).toHaveBeenCalledOnce();
    expect(result.units.map(u => u.locator)).toEqual(["p.1"]);
    expect(result.failed).toBeUndefined();
    expect(result.ocrPages).toBe(0);
    vi.doUnmock("@/lib/ai/generateText");
    vi.resetModules();
  });

  test("pdfTimeoutMs and the signal reach the PDF extractor", async () => {
    vi.resetModules();
    const extractPdfPages = vi.fn().mockResolvedValue({ pages: [PAGE_ONE], truncated: false });
    vi.doMock("@/lib/units/extractPdfPages", () => ({ extractPdfPages }));
    const { buildSourceUnits: build } = await import("@/lib/units/buildSourceUnits");
    const bytes = new Uint8Array([1, 2, 3]);
    const signal = new AbortController().signal;
    await build(input({ kind: "pdf", bytes }), { pdfTimeoutMs: 1234, signal });
    expect(extractPdfPages).toHaveBeenCalledWith(
      bytes,
      expect.objectContaining({ timeoutMs: 1234, signal }),
    );
    vi.doUnmock("@/lib/units/extractPdfPages");
    vi.resetModules();
  });
});
