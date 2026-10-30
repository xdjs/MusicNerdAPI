import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readChatEvidence } from "@/lib/evals/readChatEvidence";

describe("readChatEvidence", () => {
  it("retains exact read text, citation binding and a content hash", () => {
    const text = "Preface: In theory.\nPreserve the context.";
    expect(
      readChatEvidence("readSource", "call-1", { n: 1, url: "https://a.example/doc", text }),
    ).toEqual([
      {
        n: 1,
        url: "https://a.example/doc",
        text,
        tool: "readSource",
        toolCallId: "call-1",
        sha256: createHash("sha256").update(text).digest("hex"),
      },
    ]);
  });
  it("labels web snippets and rejects discovery or malformed results", () => {
    const result = { n: 2, url: "https://b.example", snippet: "A search excerpt" };
    expect(
      readChatEvidence("webSearch", "call-2", {
        results: [result, { n: "3", url: "x", snippet: "bad" }],
      }),
    ).toHaveLength(1);
    expect(readChatEvidence("webSearch", "call-2", { results: [result] })[0]).toMatchObject({
      tool: "webSearch",
      text: result.snippet,
    });
    expect(readChatEvidence("searchSources", "x", { sources: [result] })).toEqual([]);
    expect(
      readChatEvidence("readSource", "x", { n: 1, url: "https://a.example", text: "" }),
    ).toEqual([]);
    expect(readChatEvidence("readSource", "x", { error: "denied" })).toEqual([]);
  });
});
