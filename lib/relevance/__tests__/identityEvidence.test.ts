import { describe, expect, it } from "vitest";
import { applyVerdicts } from "@/lib/relevance/applyVerdicts";
import { identityAnchors } from "@/lib/relevance/identityAnchors";
import { relevanceExcerpt } from "@/lib/relevance/relevanceExcerpt";
import type { RelevanceRow, RelevanceVerdict } from "@/lib/relevance/types";

const anchor = { name: "Jamie Duffy", catalog: ["Anticore", "Jamie Duffy"] };
const text = "Jamie Duffy performed with Acumen Nation on Anticore before touring Chicago.";
const page = { url: "https://example.com/interview", title: "Jamie Duffy", text };
const positive = { i: 0, v: "about", identity: "match", evidence: [{ anchor: "C0", quote: text }] };
const decide = (rows: RelevanceRow[], body = text, context = anchor) => {
  const verdicts = new Map<string, RelevanceVerdict>([[page.url, "undecided"]]);
  applyVerdicts(rows, [{ ...page, text: body }], verdicts, context);
  return verdicts.get(page.url);
};

describe("identity evidence", () => {
  it("excludes names, short titles and bare numeric IDs while retaining stable fact IDs", () => {
    expect(
      identityAnchors({
        name: "Jamie Duffy",
        catalog: ["Jamie Duffy", "1999", "Up", "Anticore"],
        identifiers: ["discogs: 164081", "instagram: jamieduffyy"],
      }).map(f => f.id),
    ).toEqual(["C3", "A1"]);
  });
  it("accepts coverage supported by a real supplied anchor and passage", () => {
    expect(decide([positive])).toBe("about-artist");
    expect(decide([{ ...positive, v: "lists" }])).toBe("lists-artist");
  });
  it("never accepts a name-only match, missing evidence or an invented anchor", () => {
    expect(decide([{ i: 0, v: "about" }])).toBe("undecided");
    expect(decide([{ ...positive, evidence: [] }])).toBe("undecided");
    expect(decide([{ ...positive, evidence: [{ anchor: "C9", quote: text }] }])).toBe("undecided");
    expect(decide([{ ...positive, evidence: [{ anchor: "C1", quote: text }] }])).toBe("undecided");
    expect(decide([positive], text, { name: "Jamie Duffy", catalog: [] })).toBe("undecided");
  });
  it("rejects fabricated quotes, cross-page quotes and anchor substring matches", () => {
    expect(decide([positive], "Jamie Duffy released Solas in Ireland.")).toBe("undecided");
    expect(
      decide([{ ...positive, evidence: [{ anchor: "C0", quote: "He made Anticore." }] }]),
    ).toBe("undecided");
    const substring = text.replace("Anticore", "Anticoreography");
    expect(
      decide([{ ...positive, evidence: [{ anchor: "C0", quote: substring }] }], substring),
    ).toBe("undecided");
  });
  it("does not accept different or unresolved identities as coverage", () => {
    expect(decide([{ ...positive, identity: "different" }])).toBe("not-about-artist");
    expect(decide([{ ...positive, identity: "unresolved" }])).toBe("undecided");
  });
  it("fails closed on duplicate decisions rather than letting the last win", () => {
    expect(decide([positive, { ...positive, identity: "different" }])).toBe("undecided");
    expect(decide([{ ...positive, identity: "different" }, positive])).toBe("undecided");
  });
  it("compares visible emphasis text without inventing or joining words", () => {
    const markdown = text.replace("Anticore", "_Anticore_");
    expect(decide([positive], markdown)).toBe("about-artist");
    expect(decide([positive], text.replace("Anticore", "Anti_core"))).toBe("undecided");
  });
  it("exposes late anchor evidence within the same excerpt budget", () => {
    const body = "Navigation ".repeat(400) + text + " Tail".repeat(500);
    const excerpt = relevanceExcerpt(body, anchor);
    expect(excerpt.length).toBeLessThanOrEqual(1500);
    expect(excerpt.startsWith("Navigation")).toBe(true);
    expect(excerpt).toContain(text);
    expect(decide([positive], body)).toBe("about-artist");
  });
});
