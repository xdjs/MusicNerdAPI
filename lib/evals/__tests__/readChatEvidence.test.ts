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

    it("takes the url from the stream's source-url part for that n, over the documents entry", () => {
      const dup = [
        { n: 1, title: "A", url: "https://a.example/same" },
        { n: 2, title: "B", url: "https://a.example/same", sourceKind: "vault", sourceId: "v-2" },
      ];
      const rows = readChatEvidence(
        "searchPassages",
        "c5",
        {
          results: [
            { n: 1, locator: "p.1", title: "A", passage: "One." },
            { n: 2, locator: "p.2", title: "B", passage: "Two." },
          ],
          weak: false,
          documents: dup,
        },
        new Map([
          [1, "https://a.example/same"],
          [2, "musicnerd://vault/v-2"],
        ]),
      );
      expect(rows.map(r => r.url)).toEqual(["https://a.example/same", "musicnerd://vault/v-2"]);
    });

    it("yields nothing for a result with no documents entry and no source-url part", () => {
      expect(
        readChatEvidence("searchPassages", "c6", {
          results: [{ n: 3, locator: "p.1", title: "A", passage: "One." }],
          weak: false,
          documents: [],
        }),
      ).toEqual([]);
    });
  });
});
