import { expect, it } from "vitest";
import { isChatEvidenceCaptureComplete } from "@/lib/evals/isChatEvidenceCaptureComplete";

it("distinguishes discovery, failed reads and represented text from unsupported originals", () => {
  expect(isChatEvidenceCaptureComplete("searchSources", {}, 0)).toBe(true);
  expect(isChatEvidenceCaptureComplete("searchPdfSources", {}, 0)).toBe(true);
  expect(isChatEvidenceCaptureComplete("readSource", { n: 1 }, 1)).toBe(true);
  expect(isChatEvidenceCaptureComplete("readSource", { n: 1 }, 0)).toBe(false);
  expect(isChatEvidenceCaptureComplete("webSearch", { results: [] }, 0)).toBe(true);
  expect(isChatEvidenceCaptureComplete("webSearch", { results: [{ n: 1 }, { n: 2 }] }, 1)).toBe(
    false,
  );
  for (const tool of ["readPdfSource", "readNamedPdf"]) {
    expect(isChatEvidenceCaptureComplete(tool, { n: 1 }, 0)).toBe(false);
    expect(isChatEvidenceCaptureComplete(tool, { error: "Unavailable" }, 0)).toBe(true);
    expect(isChatEvidenceCaptureComplete(tool, { n: 1, error: "Ambiguous" }, 0)).toBe(false);
  }
  expect(isChatEvidenceCaptureComplete(undefined, {}, 0)).toBe(false);
});
