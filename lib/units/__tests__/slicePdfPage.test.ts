import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, test } from "vitest";
import { extractPdfPages } from "@/lib/units/extractPdfPages";
import { slicePdfPage } from "@/lib/units/slicePdfPage";

async function twoPagePdf(texts: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const text of texts) {
    const page = doc.addPage();
    page.drawText(text, { x: 50, y: 700, size: 18, font });
  }
  return await doc.save();
}

describe("slicePdfPage", () => {
  test("returns a one-page PDF with that page's text", async () => {
    const sliced = await slicePdfPage(await twoPagePdf(["First", "Second"]), 1);
    expect((await extractPdfPages(sliced)).pages).toEqual([expect.stringContaining("Second")]);
  });

  test("rejects a page index outside the document", async () => {
    const bytes = await twoPagePdf(["First", "Second"]);
    await expect(slicePdfPage(bytes, 2)).rejects.toThrow(/out of range/i);
    await expect(slicePdfPage(bytes, -1)).rejects.toThrow(/out of range/i);
  });
});
