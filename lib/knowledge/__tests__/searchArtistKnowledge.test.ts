import { describe, expect, it } from "vitest";
import { normalizeArtistKnowledge } from "@/lib/knowledge/normalizeArtistKnowledge";
import { searchArtistKnowledge } from "@/lib/knowledge/searchArtistKnowledge";
import { queryArtistKnowledge } from "@/lib/knowledge/queryArtistKnowledge";
import { rawKnowledge, vault } from "./fixtures";

describe("searchArtistKnowledge ranking and context", () => {
  it("retrieves a first sequencing account when the query uses the base verb", () => {
    const snapshot = normalizeArtistKnowledge({
      ...rawKnowledge,
      vault: [
        ...Array.from({ length: 8 }, (_, i) => ({
          ...vault,
          id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
          extractedText:
            "The artist first tried using music loops on a record years later. ".repeat(20),
        })),
        {
          ...vault,
          id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
          extractedText: "At eight, the artist began arranging and sequencing with a game console.",
        },
      ],
    });
    const result = searchArtistKnowledge(snapshot, {
      operation: "search",
      query: "What did the artist first use to arrange and sequence music?",
      limit: 1,
      maxChars: 1000,
    });
    expect(result.passages[0].text).toContain("game console");
  });
  it("keeps a cohesive subject phrase ahead of scattered incidental query words", () => {
    const snapshot = normalizeArtistKnowledge({
      ...rawKnowledge,
      vault: [
        {
          ...vault,
          extractedText:
            "Interview: work on a record. The past had a shadow. People work a lot. This interview was about a record.",
        },
        {
          ...vault,
          id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
          extractedText:
            "In the earlier account, she called her songs shadow work. She later described healing.",
        },
      ],
    });
    const result = searchArtistKnowledge(snapshot, {
      operation: "search",
      query: "Was shadow work only a past phase? Reconcile the interview.",
      limit: 1,
      maxChars: 1000,
    });
    expect(result.passages[0].text).toContain("called her songs shadow work");
  });
  it("does not let the already-bound artist name overwhelm the requested release", () => {
    const snapshot = normalizeArtistKnowledge({
      ...rawKnowledge,
      artist: { ...rawKnowledge.artist, name: "Mira Sol" },
      vault: [
        {
          ...vault,
          extractedText:
            "Executive producer Mira Sol. Mira Sol and Eli produced the CHAOS visual. Executive producer Mira Sol.",
        },
        {
          ...vault,
          id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
          extractedText:
            "PPNE music produced by @callmemira and Eli. The caption does not name an instrument.",
        },
      ],
    });
    const result = searchArtistKnowledge(snapshot, {
      operation: "search",
      query: "What synthesizer model did Mira Sol and Eli use to produce PPNE?",
      limit: 1,
      maxChars: 1000,
    });
    expect(result.passages[0].text).toContain("PPNE music produced");
  });
  it("ranks distinctive attribution above many incidental query words", () => {
    const filler = "The short album music interview describes the first recording process. ";
    const snapshot = normalizeArtistKnowledge({
      ...rawKnowledge,
      vault: [
        ...Array.from({ length: 12 }, (_, i) => ({
          ...vault,
          id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
          extractedText: filler.repeat(15),
        })),
        {
          ...vault,
          id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
          extractedText: "Foreword by Mira Sol. These first-person judgments belong to Mira.",
        },
      ],
    });
    const result = searchArtistKnowledge(snapshot, {
      operation: "search",
      query: "Who wrote the foreword in the short album interview?",
      limit: 1,
      maxChars: 1000,
    });
    expect(result.passages[0].text).toContain("Foreword by Mira Sol");
  });

  it("matches apostrophe and accent variants without altering original evidence or offsets", () => {
    const original =
      "🎹 The release is Jawn’adelphia, credited to Lucía Colón. Not a series credit.";
    const snapshot = normalizeArtistKnowledge({
      ...rawKnowledge,
      vault: [{ ...vault, extractedText: original }],
    });
    for (const query of ["Jawnadelphia", "Lucia Colon", "Jawn'adelphia"]) {
      const result = searchArtistKnowledge(snapshot, {
        operation: "search",
        query,
        limit: 1,
        maxChars: 1000,
      });
      expect(result.passages).toHaveLength(1);
      const hit = result.passages[0];
      expect(hit.text).toBe(original.slice(hit.start, hit.end));
      expect(hit.text).toContain("Not a series credit");
      expect(
        queryArtistKnowledge(snapshot, {
          operation: "read",
          sourceId: hit.source.sourceId,
          revision: hit.revision,
          start: hit.start,
          maxChars: 1000,
        }).passage,
      ).toEqual(hit);
    }
  });

  it("does not spend a tiny leftover budget on a clipped fragment", () => {
    const snapshot = normalizeArtistKnowledge({
      ...rawKnowledge,
      vault: [
        { ...vault, extractedText: "celesta ".repeat(200) },
        {
          ...vault,
          id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
          extractedText: "celesta in a second account. ".repeat(100),
        },
      ],
    });
    const result = searchArtistKnowledge(snapshot, {
      operation: "search",
      query: "celesta",
      limit: 5,
      maxChars: 1603,
    });
    expect(result.passages).toHaveLength(1);
    expect(result.returnedChars).toBe(1600);
    expect(result.truncated).toBe(true);
  });

  it("retains an entire naturally short original when it fits a small remainder", () => {
    const snapshot = normalizeArtistKnowledge({
      ...rawKnowledge,
      vault: [{ ...vault, extractedText: "x" }],
    });
    expect(
      searchArtistKnowledge(snapshot, { operation: "search", query: "x", limit: 1, maxChars: 1000 })
        .passages[0].text,
    ).toBe("x");
  });

  it("saturates repeated terms rather than letting keyword stuffing dominate relevance", () => {
    const snapshot = normalizeArtistKnowledge({
      ...rawKnowledge,
      vault: [
        { ...vault, extractedText: "harmonium ".repeat(150) },
        {
          ...vault,
          id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
          extractedText:
            "The harmonium was borrowed for one take; they returned it after the session.",
        },
      ],
    });
    const result = searchArtistKnowledge(snapshot, {
      operation: "search",
      query: "Was the harmonium borrowed or owned?",
      limit: 1,
      maxChars: 1000,
    });
    expect(result.passages[0].text).toContain("was borrowed");
  });

  it("does not convert matching titles or descriptions into evidence", () => {
    const snapshot = normalizeArtistKnowledge({
      ...rawKnowledge,
      vault: [
        {
          ...vault,
          title: "Lucia Colon and Jawnadelphia",
          snippet: "A celesta story",
          extractedText: "Only the original violin passage is available.",
        },
      ],
    });
    expect(
      searchArtistKnowledge(snapshot, {
        operation: "search",
        query: "Lucia Colon celesta",
        limit: 5,
        maxChars: 6000,
      }).passages,
    ).toEqual([]);
  });
});
