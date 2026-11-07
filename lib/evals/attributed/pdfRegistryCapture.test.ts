import { expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { createAttributionRegistry } from "../../attributedChat/createAttributionRegistry";
import { registerPdfPages } from "../../attributedChat/registerPdfPages";
import { readChatEvidence } from "../readChatEvidence";
import { prepareEvaluation } from "./prepareEvaluation";
import type { PdfPageManifest } from "../../chatPdf/types";
it("actual PDF registry descriptors roundtrip through capture and preparation for six synthetic fragments", async () => {
  const hash = (s: string) => createHash("sha256").update(s).digest("hex");
  const manifest: PdfPageManifest = {
    originalSha256: hash("synthetic-original"),
    physicalPages: 6,
    extractor: "pdf-parse@1.1.4/pdfjs@1.10.100/pdf-text-items-y-lines-v1",
    pages: Array.from({ length: 6 }, (_, i) => {
      const text =
        i < 2
          ? "Repeated synthetic credit [99]."
          : `Independent synthetic fragment ${i + 1} with qualification.`;
      return { physicalPage: i + 1, text, sha256: hash(text) };
    }),
    extraction: {
      engine: "pdf-parse@1.1.4/pdfjs@1.10.100",
      algorithm: "pdf-text-items-y-lines-v1",
      coverage: "all-physical-pages-text-layer",
      emptyTextPages: [],
      visualTextCompleteness: "unverified",
    },
  };
  const source = {
    id: "synthetic-source",
    revision: "synthetic-revision",
    url: "https://fixture.invalid/original.pdf",
    title: "Synthetic source",
    path: "unused",
    size: 100,
    claimId: null,
  };
  const registry = createAttributionRegistry({
    artistId: "synthetic-artist",
    turnId: "synthetic-turn",
    assertCurrent: vi.fn().mockResolvedValue(undefined),
  });
  const registered = registerPdfPages(registry, source, manifest, 1);
  const selected = await registry.resolve(
    registered.textPages.map(p => p.blocks[0].id),
    new AbortController().signal,
  );
  expect(selected).toHaveLength(6);
  expect(selected[0].text).toBe(selected[1].text);
  expect(selected[0].readId).not.toBe(selected[1].readId);
  const output = {
    sourceId: source.id,
    revision: source.revision,
    n: 1,
    url: source.url,
    title: source.title,
    pages: 6,
    sha256: manifest.originalSha256,
    ...registered,
  };
  const evidence = readChatEvidence("readPdfSource", "pdf-call", output);
  expect(evidence).toHaveLength(6);
  const input = {
    question: "Which aliases and dates are documented?",
    reference: "Synthetic fixture only.",
    answerable: true,
    answer: "",
    sources: [{ n: 1, url: source.url }],
    evidence,
    capture: {
      complete: true,
      reads: [
        {
          tool: "readPdfSource" as const,
          toolCallId: "pdf-call",
          complete: true,
          totalPages: 6,
          sourceId: source.id,
          revision: source.revision,
          originalSha256: manifest.originalSha256,
        },
      ],
    },
    attributed: {
      state: "complete-transport" as const,
      pdfTextUnavailable: false,
      passages: selected,
    },
  };
  expect(prepareEvaluation(input).status).toBe("ready");
  input.attributed.passages[0].physicalPage = 2;
  expect(prepareEvaluation(input).status).toBe("unscored");
});
