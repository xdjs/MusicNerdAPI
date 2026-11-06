import { expect, it } from "vitest";
import { readChatEvidence } from "../readChatEvidence";
it("retains server-issued binding and clones descriptors without treating preview as evidence", () => {
  const b = {
    id: "block",
    sourceId: "s",
    revision: "r",
    start: 0,
    end: 4,
    sha256: "hash",
    readId: "read",
    readStart: 0,
    readEnd: 4,
    readSha256: "hash",
    context: "bounded-read-context-v1",
    coverage: "partial-read",
    contextIncomplete: true,
    preview: "navigation only",
  };
  const output = {
    n: 1,
    url: "https://example.test",
    text: "real",
    sourceId: "s",
    revision: "r",
    start: 0,
    end: 4,
    readId: "read",
    blocks: [b],
  };
  const e = readChatEvidence("readSource", "call", output)[0];
  const { preview: _preview, ...bound } = b;
  expect(e).toMatchObject({
    sourceId: "s",
    revision: "r",
    start: 0,
    end: 4,
    readId: "read",
    text: "real",
    allowedBlocks: [bound],
  });
  expect(e.allowedBlocks![0]).not.toHaveProperty("preview");
  b.id = "mutated";
  expect(e.allowedBlocks![0].id).toBe("block");
});
it("drops malformed descriptors so they cannot authorize selections", () => {
  const e = readChatEvidence("readSource", "call", {
    n: 1,
    url: "https://example.test",
    text: "real",
    allowedBlocks: [null, {}, "bad"],
  })[0];
  expect(e.allowedBlocks).toEqual([]);
});
