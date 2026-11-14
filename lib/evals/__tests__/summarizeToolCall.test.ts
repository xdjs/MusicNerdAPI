import { describe, it, expect } from "vitest";
import { summarizeToolCall } from "@/lib/evals/summarizeToolCall";

describe("summarizeToolCall", () => {
  it("summarises searchPassages from counts and flags", () => {
    const output = {
      results: [{ n: 1, locator: "p.1", title: "T", passage: "x" }, { n: 2 }, { n: 1 }],
      weak: false,
      truncated: true,
      documents: [
        { n: 1, shown: 2, units: 10, title: "T" },
        { n: 2, shown: 1, units: 4 },
      ],
    };
    expect(summarizeToolCall("searchPassages", { query: "q" }, output)).toBe(
      "results=3 docs=2 shown/units=2/10,1/4 weak=false truncated=true expanded=none",
    );
    expect(summarizeToolCall("searchPassages", { query: "q" }, { ...output, expanded: 2 })).toBe(
      "results=3 docs=2 shown/units=2/10,1/4 weak=false truncated=true expanded=2",
    );
  });

  it("prints only the search limit error constant", () => {
    expect(
      summarizeToolCall("searchPassages", {}, { error: "Search limit reached for this answer" }),
    ).toBe("error=Search limit reached for this answer");
    expect(summarizeToolCall("searchPassages", {}, { error: "secret query text" })).toBe("error");
  });

  it("summarises readUnits", () => {
    expect(
      summarizeToolCall(
        "readUnits",
        { n: 2, locators: ["p.1", "p.2"] },
        { n: 2, units: [{ locator: "p.1", text: "a" }], truncated: false, missing: ["p.2"] },
      ),
    ).toBe("n=2 locators=2 units=1 truncated=false missing=1");
    expect(
      summarizeToolCall("readUnits", { n: 1 }, { units: [], truncated: true, missing: [] }),
    ).toBe("n=1 locators=all units=0 truncated=true missing=0");
  });

  it("reduces readUnits errors to a fixed string", () => {
    expect(summarizeToolCall("readUnits", { n: 9 }, { error: "Unknown document number" })).toBe(
      "n=9 error=Unknown document number",
    );
    expect(
      summarizeToolCall("readUnits", { n: 1 }, { error: "Source changed or is no longer public" }),
    ).toBe("n=1 error=Source changed or is no longer public");
    expect(
      summarizeToolCall("readUnits", { n: 1 }, { error: "No such locator: p.99, Secret Title" }),
    ).toBe("n=1 error=No such locator");
  });

  it("summarises the other tools", () => {
    expect(summarizeToolCall("listDocuments", {}, { documents: [{}, {}, {}] })).toBe("documents=3");
    expect(summarizeToolCall("searchSources", {}, { results: [{}, {}] })).toBe("results=2");
    expect(summarizeToolCall("readSource", {}, { n: 1, text: "t" })).toBe("ok");
    expect(summarizeToolCall("webSearch", {}, { results: [{}] })).toBe("results=1");
    expect(summarizeToolCall("webSearch", {}, { error: "boom" })).toBe("error");
    expect(summarizeToolCall("readPdfSource", {}, { n: 1, pages: 12 })).toBe("pages=12");
    expect(summarizeToolCall("readNamedPdf", {}, { error: "x" })).toBe("error");
    expect(summarizeToolCall("searchPdfSources", {}, { n: 1 })).toBe("ok");
  });

  it("is defensive about unexpected shapes", () => {
    expect(summarizeToolCall("searchPassages", undefined, null)).toBe("ok");
    expect(summarizeToolCall("readUnits", "x", 5)).toBe("ok");
    expect(summarizeToolCall("mystery", {}, { error: "x" })).toBe("error");
    expect(summarizeToolCall("mystery", {}, undefined)).toBe("ok");
  });

  it("never carries passage, title or url text", () => {
    const output = {
      results: [{ n: 1, locator: "p.1", title: "Secret Title", passage: "Secret passage" }],
      weak: false,
      truncated: false,
      documents: [
        { n: 1, shown: 1, units: 1, title: "Secret Title", url: "https://secret.example" },
      ],
      units: [{ locator: "p.1", text: "Secret passage" }],
    };
    for (const name of [
      "searchPassages",
      "readUnits",
      "listDocuments",
      "readSource",
      "webSearch",
    ]) {
      const s = summarizeToolCall(name, { query: "Secret query" }, output);
      expect(s).not.toMatch(/secret/i);
    }
  });
});
