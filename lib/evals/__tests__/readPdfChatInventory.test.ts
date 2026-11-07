import { expect, it } from "vitest";
import { createAttributionRegistry } from "@/lib/attributedChat/createAttributionRegistry";
import { registerPdfPages } from "@/lib/attributedChat/registerPdfPages";
import { pdfTextHash } from "@/lib/chatPdf/pdfTextHash";
import { readPdfChatInventory } from "../readPdfChatInventory";
import { readPdfChatEvidence } from "../readPdfChatEvidence";
import { assertPdfEvalToolOutput } from "../assertPdfEvalToolOutput";
import { prepareEvaluation } from "../attributed/prepareEvaluation";
const pin = {
  sourceId: "11111111-1111-4111-8111-111111111111",
  revision: "r1",
  filename: "fixture.pdf",
  url: "https://example.test/fixture.pdf",
  sha256: pdfTextHash("original"),
  pages: 3,
  bytes: 123,
};
function output(texts = ["An account.", " ", "A qualification."]) {
  const source = {
    id: pin.sourceId,
    revision: pin.revision,
    title: pin.filename,
    url: pin.url,
    path: "fixture.pdf",
    size: pin.bytes,
    claimId: null,
  };
  const registry = createAttributionRegistry({
    artistId: "fixture",
    turnId: "fixture",
    assertCurrent: async () => {},
  });
  const registered = registerPdfPages(
    registry,
    source,
    {
      originalSha256: pin.sha256,
      physicalPages: 3,
      pages: texts.map((text, i) => ({ physicalPage: i + 1, text, sha256: pdfTextHash(text) })),
    } as never,
    1,
  );
  return {
    sourceId: pin.sourceId,
    revision: pin.revision,
    title: pin.filename,
    url: pin.url,
    n: 1,
    pages: 3,
    sha256: pin.sha256,
    ...registered,
  };
}
it("keeps available page evidence and explicit unavailable identities without treating them as evidence", () => {
  const value = output();
  const inventory = readPdfChatInventory("readPdfSource", "t", value)!;
  expect(inventory.unavailablePages).toEqual([2]);
  expect(inventory.evidence.map(e => e.physicalPage)).toEqual([1, 3]);
  expect(readPdfChatEvidence("readPdfSource", "t", value)).toEqual(inventory.evidence);
  expect(() => assertPdfEvalToolOutput(value, pin, "readPdfSource", "t")).not.toThrow();
});
it.each(["missing", "reordered", "wrong-hash", "false-unavailable", "unknown-field"])(
  "rejects %s page status inventory",
  kind => {
    const value: any = output();
    if (kind === "missing") value.textPages.splice(1, 1);
    if (kind === "reordered") value.textPages.reverse();
    if (kind === "wrong-hash") value.textPages[1].pageSha256 = "0".repeat(64);
    if (kind === "false-unavailable")
      value.textPages[0] = {
        ...value.textPages[1],
        physicalPage: 1,
        text: "An account.",
        end: 11,
        sha256: pdfTextHash("An account."),
        pageSha256: pdfTextHash("An account."),
      };
    if (kind === "unknown-field")
      value.textPages[1].privateData = Buffer.from("%PDF-private").toString("base64");
    expect(() => assertPdfEvalToolOutput(value, pin, "readPdfSource", "t")).toThrow();
  },
);
it("accepts an all-unavailable status inventory but produces no textual evidence", () => {
  const value = output(["", " ", "\n"]);
  expect(readPdfChatInventory("readPdfSource", "t", value)).toEqual({
    evidence: [],
    unavailablePages: [1, 2, 3],
  });
  expect(() => assertPdfEvalToolOutput(value, pin, "readPdfSource", "t")).not.toThrow();
});
it("partial PDF capture cannot become an automatic semantic pass", () => {
  const inventory = readPdfChatInventory("readPdfSource", "t", output())!;
  const result = prepareEvaluation({
    question: "Which accounts?",
    reference: "Human rubric",
    answerable: true,
    answer: "",
    sources: [{ n: 1, url: pin.url }],
    evidence: inventory.evidence,
    capture: {
      complete: true,
      reads: [
        {
          tool: "readPdfSource",
          toolCallId: "t",
          complete: false,
          totalPages: 3,
          sourceId: pin.sourceId,
          revision: pin.revision,
          originalSha256: pin.sha256,
        },
      ],
    },
    attributed: { state: "complete-transport", pdfTextUnavailable: true, passages: [] },
  });
  expect(result.status).toBe("unscored");
});
