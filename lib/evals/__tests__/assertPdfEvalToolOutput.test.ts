import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { createAttributionRegistry } from "@/lib/attributedChat/createAttributionRegistry";
import { registerPdfPages } from "@/lib/attributedChat/registerPdfPages";
import { assertPdfEvalToolOutput } from "../assertPdfEvalToolOutput";
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const pin = {
  sourceId: "11111111-1111-4111-8111-111111111111",
  revision: "r1",
  filename: "fixture.pdf",
  url: "https://example.test/fixture.pdf",
  sha256: hash("synthetic original"),
  pages: 1,
  bytes: 123,
};
function output() {
  const source = {
    id: pin.sourceId,
    revision: pin.revision,
    title: pin.filename,
    url: "https://example.test/fixture.pdf",
    path: "fixture.pdf",
    size: pin.bytes,
    claimId: null,
  };
  const registry = createAttributionRegistry({
    artistId: "fixture",
    turnId: "fixture",
    maxTextCharacters: 12000,
    assertCurrent: async () => {},
  });
  const text = "A synthetic, qualified source account. [Original footnote]";
  const registered = registerPdfPages(
    registry,
    source,
    {
      originalSha256: pin.sha256,
      physicalPages: 1,
      pages: [{ physicalPage: 1, text, sha256: hash(text) }],
    } as never,
    1,
  );
  return {
    sourceId: pin.sourceId,
    revision: pin.revision,
    title: pin.filename,
    n: 1,
    url: source.url,
    sha256: pin.sha256,
    pages: pin.pages,
    ...registered,
  };
}
it("accepts the unchanged current registered page/block shape", () => {
  expect(() => assertPdfEvalToolOutput(output(), pin, "readPdfSource", "t")).not.toThrow();
});
it.each(["readSha256", "readStart", "readEnd", "context", "preview"])(
  "rejects an unbound known descriptor field %s",
  field => {
    const value: any = output();
    value.textPages[0].blocks[0][field] = Buffer.from("%PDF-private").toString("base64");
    expect(() => assertPdfEvalToolOutput(value, pin, "readPdfSource", "t")).toThrow();
  },
);
it("rejects arbitrary text in a notice or an unpinned URL", () => {
  const value: any = output();
  value.textPages[0].limitation = Buffer.from("%PDF-private").toString("base64");
  expect(() => assertPdfEvalToolOutput(value, pin, "readPdfSource", "t")).toThrow();
  expect(() =>
    assertPdfEvalToolOutput(output(), { ...pin, url: undefined }, "readPdfSource", "t"),
  ).toThrow();
});
it.each(["root", "page", "block", "reopened"])("rejects unknown %s fields before capture", kind => {
  const value: any = output();
  const blob = Buffer.from("%PDF-synthetic-private").toString("base64");
  if (kind === "root") value.unexpected = blob;
  if (kind === "page") value.textPages[0].unexpected = blob;
  if (kind === "block") value.textPages[0].blocks[0].unexpected = blob;
  if (kind === "reopened") value.reopened = { unexpected: blob };
  expect(() => assertPdfEvalToolOutput(value, pin, "readPdfSource", "t")).toThrow(
    "eval_pdf_identity",
  );
});
it("accepts only the ordinary fixed error shape, without registering it as a successful read", () => {
  expect(() =>
    assertPdfEvalToolOutput({ error: "PDF unavailable" }, undefined, "readPdfSource", "t"),
  ).not.toThrow();
  expect(() =>
    assertPdfEvalToolOutput(
      { error: "PDF unavailable", textUnavailable: "verified_pdf_page_text_unavailable" },
      undefined,
      "readPdfSource",
      "t",
    ),
  ).not.toThrow();
  expect(() =>
    assertPdfEvalToolOutput(
      { error: Buffer.from("%PDF-private").toString("base64") },
      undefined,
      "readPdfSource",
      "t",
    ),
  ).toThrow();
});
