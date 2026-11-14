import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, test } from "vitest";
import { extractPdfPages } from "@/lib/units/extractPdfPages";
import { sliceLoadedPdfPage } from "@/lib/units/sliceLoadedPdfPage";

async function pdf(texts: string[]): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const text of texts) doc.addPage().drawText(text, { x: 50, y: 700, size: 18, font });
  return await PDFDocument.load(await doc.save());
}

describe("sliceLoadedPdfPage", () => {
  test("cuts one page of a parsed document into its own one-page PDF", async () => {
    const doc = await pdf(["First", "Second", "Third"]);
    const third = await sliceLoadedPdfPage(doc, 2);
    const first = await sliceLoadedPdfPage(doc, 0);
    expect((await extractPdfPages(third)).pages).toEqual([expect.stringContaining("Third")]);
    expect((await extractPdfPages(first)).pages).toEqual([expect.stringContaining("First")]);
  });

  test("rejects a page index outside the document", async () => {
    const doc = await pdf(["First", "Second"]);
    await expect(sliceLoadedPdfPage(doc, 2)).rejects.toThrow(/out of range/i);
    await expect(sliceLoadedPdfPage(doc, -1)).rejects.toThrow(/out of range/i);
  });
});
