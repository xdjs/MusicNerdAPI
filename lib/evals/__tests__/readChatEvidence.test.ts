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

  describe("passage tools", () => {
    const documents = [
      { n: 1, title: "Doc", url: "https://a.example/doc.pdf" },
      { n: 2, title: "Note", url: null, sourceKind: "evidence", sourceId: "e-1" },
    ];
    const sha = (t: string) => createHash("sha256").update(t).digest("hex");

    it("makes one row per searchPassages result, with the locator in the text", () => {
      const rows = readChatEvidence("searchPassages", "c1", {
        results: [
          { n: 1, locator: "p.3", title: "Doc", passage: "Born in 1970." },
          { n: 2, locator: "p.1", title: "Note", passage: "Signed in 1999." },
        ],
        weak: false,
        documents,
      });
      expect(rows).toEqual([
        {
          n: 1,
          url: "https://a.example/doc.pdf",
          text: "[p.3]\nBorn in 1970.",
          tool: "searchPassages",
          toolCallId: "c1",
          sha256: sha("[p.3]\nBorn in 1970."),
        },
        {
          n: 2,
          url: "musicnerd://evidence/e-1",
          text: "[p.1]\nSigned in 1999.",
          tool: "searchPassages",
          toolCallId: "c1",
          sha256: sha("[p.1]\nSigned in 1999."),
        },
      ]);
    });

    it("makes one row per unit read, and none for an error", () => {
      const rows = readChatEvidence("readUnits", "c2", {
        n: 1,
        title: "Doc",
        units: [
          { locator: "p.4", text: "Four." },
          { locator: "p.5", text: "Five." },
          { locator: "p.6", text: "  " },
        ],
        truncated: false,
        missing: [],
        documents: [documents[0]],
      });
      expect(rows.map(r => [r.n, r.url, r.text, r.tool])).toEqual([
        [1, "https://a.example/doc.pdf", "[p.4]\nFour.", "readUnits"],
        [1, "https://a.example/doc.pdf", "[p.5]\nFive.", "readUnits"],
      ]);
      expect(readChatEvidence("readUnits", "c3", { error: "nope" })).toEqual([]);
      expect(readChatEvidence("searchPassages", "c4", { error: "nope" })).toEqual([]);
    });
  });
});
