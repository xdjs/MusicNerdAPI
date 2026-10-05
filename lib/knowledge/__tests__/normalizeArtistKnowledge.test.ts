import { describe, expect, it } from "vitest";
import { normalizeArtistKnowledge } from "@/lib/knowledge/normalizeArtistKnowledge";
import { rawKnowledge, vault, social } from "./fixtures";

describe("normalizeArtistKnowledge", () => {
  it("keeps a misleading title/description separate from searchable original text", () => {
    const snapshot = normalizeArtistKnowledge({ ...rawKnowledge, vault: [vault] });
    const source = snapshot.sources[0];
    expect(source.text).toBe("The architecture keeps attention. No graph framework is proposed.");
    expect(source.metadata.title).toBe("Keep Graph changes everything");
    expect(source.metadata.description).toBe("A graph memory breakthrough");
    expect(source.metadata.publishedAt).toBe("2023-05-19");
    expect(source.metadata.eventDate).toBeNull();
    expect(source.metadata.originalSourceUrl).toBeNull();
    expect(source.metadata.provenance.speaker).toBe("unverified");
  });

  it("does not turn metadata-only or rejected vault records into evidence", () => {
    const snapshot = normalizeArtistKnowledge({
      ...rawKnowledge,
      vault: [
        { ...vault, extractedText: null },
        { ...vault, id: "b", status: "rejected" },
      ],
    });
    expect(snapshot.sources).toHaveLength(1);
    expect(snapshot.sources[0].text).toBe("");
    expect(snapshot.sources[0].metadata.extraction.readiness).toBe("unknown");
    expect(snapshot.coverage).toMatchObject({
      eligibleSources: 1,
      readableSources: 0,
      complete: false,
    });
  });

  it("pins text and citation metadata but not retrieval time in a source revision", () => {
    const get = (item: typeof vault) =>
      normalizeArtistKnowledge({ ...rawKnowledge, vault: [item] }).sources[0].metadata.revision;
    expect(get(vault)).toMatch(/^[a-f0-9]{64}$/);
    expect(get({ ...vault, updatedAt: "2026-10-06T00:00:00Z" })).toBe(get(vault));
    expect(
      get({ ...vault, extractedText: `${vault.extractedText} However, that is qualified.` }),
    ).not.toBe(get(vault));
    expect(get({ ...vault, publishedAt: "2022-05-19" })).not.toBe(get(vault));
  });

  it("hides upload locations, preserves complete stored bodies and marks legacy extraction limits", () => {
    const text = "PDF passage. ".repeat(6000);
    const snapshot = normalizeArtistKnowledge({
      ...rawKnowledge,
      vault: [
        {
          ...vault,
          filePath: "private/file.pdf",
          type: "pdf",
          url: "https://storage.invalid/private?token=secret",
          extractedText: text,
        },
      ],
    });
    expect(snapshot.sources[0].metadata.url).toBeNull();
    expect(snapshot.sources[0].text).toBe(text);
    expect(snapshot.sources[0].metadata.extraction.truncated).toBeNull();
    expect(snapshot.sources[0].metadata.extraction.limitations.join(" ")).toMatch(/PDF|page|OCR/i);
  });

  it("only exposes own eligible social text and provenance-marked reel speech with unknown speaker", () => {
    const snapshot = normalizeArtistKnowledge({
      ...rawKnowledge,
      social: [
        social,
        { ...social, id: "foreign", isOwnPost: false },
        { ...social, id: "repost", isRepost: true },
      ],
    });
    expect(snapshot.sources).toHaveLength(2);
    const transcript = snapshot.sources.find(s => s.metadata.kind === "reel_transcript")!;
    expect(transcript.text).toBe("Someone says: I sampled that record.");
    expect(transcript.metadata.provenance).toMatchObject({
      speaker: "unverified",
      speakerName: null,
      publisher: "fixtureartist",
      provider: "apify/instagram-reel-scraper",
      relationship: "unknown",
    });
    expect(JSON.stringify(snapshot)).not.toContain("private-run");
    expect(JSON.stringify(snapshot)).not.toContain("provider-secret");
    expect(
      normalizeArtistKnowledge({
        ...rawKnowledge,
        social: [{ ...social, transcript: { version: 1, text: "unmarked" } }],
      }).sources,
    ).toHaveLength(1);
  });

  it("refuses oversized snapshots instead of returning partial successful coverage", () => {
    expect(() =>
      normalizeArtistKnowledge({ ...rawKnowledge, vault: Array(5001).fill(vault) }),
    ).toThrow(/corpus/i);
    expect(() =>
      normalizeArtistKnowledge({
        ...rawKnowledge,
        vault: [{ ...vault, extractedText: "x".repeat(4_000_001) }],
      }),
    ).toThrow(/corpus/i);
  });
});

it("returns sanitized source extraction outcomes without job secrets", () => {
  const outcome = {
    sourceId: vault.id,
    status: "blocked",
    capturedAt: "2026-10-05T00:00:00.000Z",
    httpStatus: 403,
    storedChars: 0,
    truncated: false,
  };
  const r = normalizeArtistKnowledge({
    ...rawKnowledge,
    jobs: [
      {
        id: vault.id,
        artistId: rawKnowledge.artist.id,
        kind: "source_extract",
        status: "done",
        cursor: 1,
        total: 1,
        updatedAt: "2026-10-05T00:00:00Z",
        extractionOutcomes: [
          { ...outcome, url: "https://private.example?token=secret", userId: "secret" },
        ],
      },
    ],
  });
  expect(r.jobs[0].extractionOutcomes).toEqual([outcome]);
  expect(JSON.stringify(r.jobs)).not.toContain("secret");
});
