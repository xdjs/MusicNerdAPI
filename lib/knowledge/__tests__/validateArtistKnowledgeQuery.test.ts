import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { validateArtistKnowledgeQuery } from "@/lib/knowledge/validateArtistKnowledgeQuery";
import { artistId } from "./fixtures";

describe("validateArtistKnowledgeQuery", () => {
  it("parses bounded defaults and preserves artist scope outside model-controlled query", () => {
    expect(
      validateArtistKnowledgeQuery(
        new Request("https://example.org?query=+piano+"),
        artistId,
        "search",
      ),
    ).toEqual({ operation: "search", query: "piano", limit: 5, maxChars: 6000 });
    expect(
      validateArtistKnowledgeQuery(new Request("https://example.org"), artistId, "history"),
    ).toEqual({ operation: "history", kind: "all", limit: 20, maxChars: 12000 });
  });
  it.each([
    "?query=",
    "?query=x&limit=0",
    "?query=x&limit=11",
    "?query=x&maxChars=20000",
    "?query=x&limit=1.5",
    "?query=x&limit=1e1",
    "?query=x&limit=",
    "?query=x&query=y",
    "?query=x&accountId=other",
    "?query=x&kind=summary",
  ])("rejects %s with a public 400", async suffix => {
    const result = validateArtistKnowledgeQuery(
      new Request(`https://example.org${suffix}`),
      artistId,
      "search",
    );
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
    expect(await (result as NextResponse).json()).toMatchObject({
      status: "error",
      code: "invalid_input",
    });
  });
  it("rejects invalid IDs, unknown parameters and absent source revisions", () => {
    expect(
      validateArtistKnowledgeQuery(new Request("https://example.org"), "bad", "brief"),
    ).toBeInstanceOf(NextResponse);
    expect(
      validateArtistKnowledgeQuery(
        new Request("https://example.org?url=https://external.invalid"),
        artistId,
        "brief",
      ),
    ).toBeInstanceOf(NextResponse);
    expect(
      validateArtistKnowledgeQuery(
        new Request("https://example.org"),
        artistId,
        "read",
        `vault:${artistId}`,
      ),
    ).toBeInstanceOf(NextResponse);
  });
});

it("validates the explicit historical-read opt-in and rejects malformed source UUIDs", () => {
  const base = `https://example.org?revision=${"a".repeat(64)}`;
  const sourceId = "vault:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  expect(
    validateArtistKnowledgeQuery(new Request(base + "&includeVersion=true"), id, "read", sourceId),
  ).toMatchObject({ includeVersion: true });
  expect(
    validateArtistKnowledgeQuery(new Request(base + "&includeVersion=false"), id, "read", sourceId),
  ).toMatchObject({ includeVersion: false });
  expect(
    validateArtistKnowledgeQuery(new Request(base + "&includeVersion=yes"), id, "read", sourceId),
  ).toMatchObject({ status: 400 });
  expect(
    validateArtistKnowledgeQuery(new Request(base), id, "read", "vault:" + "-".repeat(36)),
  ).toMatchObject({ status: 400 });
});
