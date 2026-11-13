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
    expect(result.failed).toBe("vision");
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
    expect(result).toEqual({ units: [], ocrPages: 0, truncated: false });
  });

  test("hash and token count are set", async () => {
    const result = await buildSourceUnits(input({ kind: "plain", text: "Some plain words here." }));
    const unit = result.units[0];
    expect(unit.textHash).toBe(createHash("sha256").update(unit.text).digest("hex"));
    expect(unit.tokens).toBe(Math.ceil(unit.text.length / 4));
  });
});
