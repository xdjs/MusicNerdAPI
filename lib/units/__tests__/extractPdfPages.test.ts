import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, test, vi } from "vitest";
import { extractPdfPages } from "@/lib/units/extractPdfPages";

const failingPage = vi.hoisted(() => ({ number: 0 }));
vi.mock("@/lib/units/renderPdfPageText", async importActual => {
  const actual = await importActual<typeof import("@/lib/units/renderPdfPageText")>();
  return {
    renderPdfPageText: async (pageData: Parameters<typeof actual.renderPdfPageText>[0]) => {
      if (pageData.pageNumber === failingPage.number) throw new Error("unreadable page");
      return actual.renderPdfPageText(pageData);
    },
  };
});

async function twoPagePdf(texts: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const text of texts) {
    const page = doc.addPage();
    page.drawText(text, { x: 50, y: 700, size: 18, font });
  }
  return await doc.save();
}

describe("extractPdfPages", () => {
  test("returns one entry per physical page in order", async () => {
    const bytes = await twoPagePdf(["Alpha one", "Beta two"]);
    const result = await extractPdfPages(bytes);
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0]).toContain("Alpha one");
    expect(result.pages[1]).toContain("Beta two");
    expect(result.pages[0]).not.toContain("Beta");
    expect(result.truncated).toBe(false);
  });

  test("stops at maxPages and reports truncation", async () => {
    const bytes = await twoPagePdf(["A", "B"]);
    const result = await extractPdfPages(bytes, { maxPages: 1 });
    expect(result.pages).toHaveLength(1);
    expect(result.truncated).toBe(true);
  });

  test("rejects when the parse exceeds the timeout", async () => {
    await expect(extractPdfPages(await twoPagePdf(["A"]), { timeoutMs: 0 })).rejects.toThrow(
      /timed out/i,
    );
  });

  test("keeps later pages at their physical index when one page fails to render", async () => {
    failingPage.number = 2;
    try {
      const bytes = await twoPagePdf(["Alpha", "Beta", "Gamma"]);
      const result = await extractPdfPages(bytes);
      expect(result.pages).toHaveLength(3);
      expect(result.pages[0]).toContain("Alpha");
      expect(result.pages[1]).toBe("");
      expect(result.pages[2]).toContain("Gamma");
    } finally {
      failingPage.number = 0;
    }
  });
});
