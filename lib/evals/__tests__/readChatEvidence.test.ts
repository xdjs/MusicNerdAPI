import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readChatEvidence } from "@/lib/evals/readChatEvidence";

describe("readChatEvidence", () => {
  it("preserves the read tool's date context without inventing dates for snippets", () => {
    const output = {
      n: 1,
      url: "https://a.example/post",
      text: "An archival update.",
      publishedAt: "2024-09-15T00:00:00Z",
      activityDate: null,
      retrievedAt: "2026-10-29T00:00:00Z",
    };
    expect(readChatEvidence("readSource", "date-read", output)[0]).toMatchObject({
      publishedAt: output.publishedAt,
      activityDate: null,
      retrievedAt: output.retrievedAt,
    });
    const snippet = readChatEvidence("webSearch", "search", {
      results: [{ ...output, snippet: output.text }],
    })[0];
    expect(snippet).not.toHaveProperty("publishedAt");
    expect(snippet).not.toHaveProperty("retrievedAt");
  });
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
