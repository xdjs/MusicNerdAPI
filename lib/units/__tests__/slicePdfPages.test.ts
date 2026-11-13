import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, test, vi } from "vitest";
import { extractPdfPages } from "@/lib/units/extractPdfPages";
import { slicePdfPages } from "@/lib/units/slicePdfPages";

async function pdf(texts: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const text of texts) doc.addPage().drawText(text, { x: 50, y: 700, size: 18, font });
  return await doc.save();
}

describe("slicePdfPages", () => {
  test("returns a one-page PDF per index, in the order asked", async () => {
    const slices = await slicePdfPages(await pdf(["First", "Second", "Third"]), [2, 0]);
    expect(slices).toHaveLength(2);
    expect((await extractPdfPages(slices[0])).pages).toEqual([expect.stringContaining("Third")]);
    expect((await extractPdfPages(slices[1])).pages).toEqual([expect.stringContaining("First")]);
  });

  test("parses the document once for every slice", async () => {
    const bytes = await pdf(["First", "Second", "Third"]);
    const load = vi.spyOn(PDFDocument, "load");
    try {
      await slicePdfPages(bytes, [0, 1, 2]);
      expect(load).toHaveBeenCalledOnce();
    } finally {
      load.mockRestore();
    }
  });

  test("returns nothing for no indexes", async () => {
    expect(await slicePdfPages(await pdf(["First"]), [])).toEqual([]);
  });

  test("rejects a page index outside the document", async () => {
    const bytes = await pdf(["First", "Second"]);
    await expect(slicePdfPages(bytes, [0, 2])).rejects.toThrow(/out of range/i);
    await expect(slicePdfPages(bytes, [-1])).rejects.toThrow(/out of range/i);
  });
});
