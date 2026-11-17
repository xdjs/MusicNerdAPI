import { PDFDocument } from "pdf-lib";
import { describe, expect, test } from "vitest";
import { loadPdfDocument } from "@/lib/units/loadPdfDocument";

const pdf = async (pages: number) => {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage();
  return await doc.save();
};

describe("loadPdfDocument", () => {
  test("parses the document", async () => {
    expect((await loadPdfDocument(await pdf(3))).getPageCount()).toBe(3);
  });

  test("rejects at once when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(loadPdfDocument(await pdf(1), controller.signal)).rejects.toThrow(/aborted/i);
  });

  test("rejects when the signal aborts during the parse", async () => {
    const controller = new AbortController();
    const loading = loadPdfDocument(await pdf(50), controller.signal);
    controller.abort();
    await expect(loading).rejects.toThrow(/aborted/i);
  });

  test("rejects bytes that are not a PDF", async () => {
    await expect(loadPdfDocument(new Uint8Array([1, 2, 3]))).rejects.toThrow();
  });
});
