import { expect, it } from "vitest";
import { createAttributionRegistry } from "@/lib/attributedChat/createAttributionRegistry";
import { registerPdfPages } from "@/lib/attributedChat/registerPdfPages";
import { isVerifiedPdfManifest } from "../isVerifiedPdfManifest";
import { assertPdfPageRegistration } from "../assertPdfPageRegistration";
import { assertPdfTextLocator } from "../assertPdfTextLocator";
import { pdfTextHash } from "../pdfTextHash";
import type { PdfPageManifest } from "../types";
const bytes = Buffer.from("%PDF-synthetic-unit-only");
const source = {
  id: "11111111-1111-4111-8111-111111111111",
  revision: "r1",
  title: "fixture.pdf",
  url: "https://example.test/fixture.pdf",
  path: "fixture.pdf",
  size: bytes.length,
  claimId: null,
};
const manifest: PdfPageManifest = {
  originalSha256: pdfTextHash(bytes),
  extractor: "pdf-parse@1.1.4/pdfjs@1.10.100/pdf-text-items-y-lines-v1",
  physicalPages: 3,
  pages: ["An attributed account. [1]", " ", "A later qualification. 😀"].map((text, i) => ({
    physicalPage: i + 1,
    text,
    sha256: pdfTextHash(text),
  })),
  extraction: {
    engine: "pdf-parse@1.1.4/pdfjs@1.10.100",
    algorithm: "pdf-text-items-y-lines-v1",
    coverage: "all-physical-pages-text-layer",
    emptyTextPages: [2],
    visualTextCompleteness: "unverified",
  },
};
it("verifies original-bound empty text status without pretending the whole document is unavailable", () => {
  expect(isVerifiedPdfManifest(manifest, bytes, manifest.originalSha256, 3)).toBe(true);
  const wrong = structuredClone(manifest);
  wrong.extraction.emptyTextPages = [];
  expect(isVerifiedPdfManifest(wrong, bytes, manifest.originalSha256, 3)).toBe(false);
});
it("preserves physical positions and exact text, marks missing text and issues no ID for it", async () => {
  const registry = createAttributionRegistry({
    artistId: "fixture",
    turnId: "fixture",
    assertCurrent: async () => {},
  });
  const output = registerPdfPages(registry, source, manifest, 1);
  expect(output.textPages).toHaveLength(3);
  expect(output.textPages.map(p => p.physicalPage)).toEqual([1, 2, 3]);
  expect(output.textPages.map(p => p.text)).toEqual(manifest.pages.map(p => p.text));
  expect(output.textPages[1]).toMatchObject({
    kind: "pdf-page-unavailable",
    availability: "no-extracted-text",
    physicalPage: 2,
    physicalPages: 3,
    blocks: [],
    originalSha256: manifest.originalSha256,
  });
  expect(output.textPages[1]).not.toHaveProperty("readId");
  expect(output.textPages[1]).not.toHaveProperty("blank");
  expect(registry.pdfUnavailable).toBe(true);
  expect(() => assertPdfPageRegistration(output.textPages, source, manifest, 1)).not.toThrow();
  const selected = await registry.resolve(
    [output.textPages[2].blocks[0].id],
    new AbortController().signal,
  );
  expect(selected[0]).toMatchObject({
    physicalPage: 3,
    physicalPages: 3,
    text: manifest.pages[2].text,
  });
  const missing = { ...output.textPages[0], physicalPage: 2, kind: "pdf-page-text" };
  expect(() =>
    assertPdfPageRegistration(
      [output.textPages[0], missing, output.textPages[2]] as never,
      source,
      manifest,
      1,
    ),
  ).toThrow();
});
it("rejects locators on unavailable text while preserving other page locators", () => {
  const locator = {
    sourceId: source.id,
    revision: source.revision,
    originalSha256: manifest.originalSha256,
    physicalPage: 2,
    pageSha256: manifest.pages[1].sha256,
    start: 0,
    end: 1,
    sha256: pdfTextHash(" "),
  };
  expect(() => assertPdfTextLocator(locator, source, manifest)).toThrow();
});
