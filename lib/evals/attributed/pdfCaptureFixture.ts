import { createHash } from "node:crypto";
import { readChatEvidence } from "../readChatEvidence";
import type { EvaluationInput } from "./types";
/** Synthetic transport fixture only, with no artist-specific facts or semantic labels. */
export function pdfCaptureFixture(tool: "readPdfSource" | "readNamedPdf" = "readPdfSource") {
  const hash = (s: string) => createHash("sha256").update(s).digest("hex");
  const originalSha256 = hash("synthetic-original-byte-identity");
  const textPages = Array.from({ length: 6 }, (_, index) => {
    const text =
      index < 2
        ? "A repeated synthetic credit [99]."
        : `Synthetic credit fragment ${index + 1}. Qualification stays on this physical page.`;
    const identity = {
      kind: "pdf-page-text" as const,
      originalSha256,
      physicalPage: index + 1,
      physicalPages: 6,
      pageSha256: hash(text),
    };
    const binding = {
      ...identity,
      id: hash(`block-${index}`),
      sourceId: "pdf:synthetic",
      revision: "revision-fixture",
      start: 0,
      end: text.length,
      sha256: hash(text),
      readId: hash(`read-page-${index}`),
      readStart: 0,
      readEnd: text.length,
      readSha256: hash(text),
      context: "pdf-page-context-v1" as const,
      contextIncomplete: true,
      coverage: "complete-read" as const,
    };
    return {
      ...binding,
      n: 1,
      title: "Synthetic original",
      url: "https://fixture.invalid/original.pdf",
      text,
      blocks: [{ ...binding }],
    };
  });
  const output = {
    sourceId: "pdf:synthetic",
    revision: "revision-fixture",
    n: 1,
    title: "Synthetic original",
    url: "https://fixture.invalid/original.pdf",
    pages: 6,
    sha256: originalSha256,
    textPages,
  };
  const attribution = {
    state: "complete-transport" as const,
    pdfTextUnavailable: false,
    passages: textPages.map(({ blocks: _blocks, ...p }) => p),
  };
  const input: EvaluationInput = {
    question: "Which names and dates are documented?",
    reference: "Synthetic diagnostic fixture; no semantic finding.",
    answerable: true,
    answer: "",
    sources: [{ n: 1, url: output.url }],
    evidence: readChatEvidence(tool, "pdf-call", output),
    capture: {
      complete: true,
      reads: [
        {
          tool,
          toolCallId: "pdf-call",
          complete: true,
          totalPages: 6,
          sourceId: output.sourceId,
          revision: output.revision,
          originalSha256,
        },
      ],
    },
    attributed: attribution,
  };
  return { output, input, attribution };
}
