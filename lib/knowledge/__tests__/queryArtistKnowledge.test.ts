import { describe, expect, it } from "vitest";
import { normalizeArtistKnowledge } from "@/lib/knowledge/normalizeArtistKnowledge";
import { queryArtistKnowledge } from "@/lib/knowledge/queryArtistKnowledge";
import { knowledgeWindow } from "@/lib/knowledge/knowledgeWindow";
import type { KnowledgeResults } from "@/lib/knowledge/types";
import { answer, artistId, correction, rawKnowledge, vault } from "./fixtures";

describe("queryArtistKnowledge", () => {
  it("can search a one-character original without turning it into a storage error", () => {
    const snapshot = normalizeArtistKnowledge({
      ...rawKnowledge,
      vault: [{ ...vault, extractedText: "x" }],
    });
    expect(
      queryArtistKnowledge(snapshot, { operation: "search", query: "x", limit: 1, maxChars: 1000 })
        .passages[0].text,
    ).toBe("x");
  });
  it("finds a qualified passage deep inside a PDF and resolves exactly the same source/revision", () => {
    const text =
      "An unrelated opening. ".repeat(500) +
      "I tried granular synthesis, but rejected it for the final album. " +
      "Another paragraph. ".repeat(100);
    const snapshot = normalizeArtistKnowledge({
      ...rawKnowledge,
      vault: [{ ...vault, extractedText: text, type: "pdf" }],
    });
    const found = queryArtistKnowledge(snapshot, {
      operation: "search",
      query: "granular synthesis",
      limit: 5,
      maxChars: 6000,
    });
    expect(found.passages[0].start).toBeGreaterThan(4000);
    expect(found.passages[0].text).toContain("but rejected it for the final album");
    const hit = found.passages[0];
    const read = queryArtistKnowledge(snapshot, {
      operation: "read",
      sourceId: hit.source.sourceId,
      revision: hit.revision,
      start: hit.start,
      maxChars: hit.text.length,
    });
    expect(read.passage).toEqual(hit);
    expect(text.slice(hit.start, hit.end)).toBe(hit.text);
    expect(hit.page).toBeNull();
    expect(found.coverage).toMatchObject({ searchedSources: 1, complete: true });
  });

  it("does not support a headline premise when only the original body contradicts it", () => {
    const snapshot = normalizeArtistKnowledge({
      ...rawKnowledge,
      vault: [
        {
          ...vault,
          title: "A modular breakthrough",
          extractedText: "This was recorded with a piano.",
        },
      ],
    });
    expect(
      queryArtistKnowledge(snapshot, {
        operation: "search",
        query: "modular breakthrough",
        limit: 5,
        maxChars: 6000,
      }).passages,
    ).toEqual([]);
  });

  it("returns explicit coverage for unreadable sources and bounds search text", () => {
    const snapshot = normalizeArtistKnowledge({
      ...rawKnowledge,
      vault: [
        { ...vault, extractedText: "piano session ".repeat(2000) },
        { ...vault, id: "ffffffff-ffff-4fff-8fff-ffffffffffff", extractedText: null },
      ],
    });
    const result = queryArtistKnowledge(snapshot, {
      operation: "search",
      query: "piano",
      limit: 10,
      maxChars: 1000,
    });
    expect(result.returnedChars).toBeLessThanOrEqual(1000);
    expect(result.truncated).toBe(true);
    expect(result.coverage).toMatchObject({
      eligibleSources: 2,
      readableSources: 1,
      searchedSources: 1,
      complete: false,
    });
  });

  it("does not split Unicode or lose characters while reading successive windows", () => {
    const text = "a".repeat(999) + "🎹" + "b".repeat(998) + "🎵" + "c";
    const snapshot = normalizeArtistKnowledge({
      ...rawKnowledge,
      vault: [{ ...vault, extractedText: text }],
    });
    const source = snapshot.sources[0].metadata;
    let start: number | null = 0;
    let recovered = "";
    while (start !== null) {
      const result: KnowledgeResults["read"] = queryArtistKnowledge(snapshot, {
        operation: "read",
        sourceId: source.sourceId,
        revision: source.revision,
        start,
        maxChars: 1000,
      });
      expect(result.passage.end - result.passage.start).toBe(result.passage.text.length);
      expect(result.passage.text.isWellFormed()).toBe(true);
      recovered += result.passage.text;
      start = result.nextStart;
    }
    expect(recovered).toBe(text);
    expect(knowledgeWindow(text, 1000, 1000).start).toBe(999);
  });

  it("rejects changed revisions, removed sources and out-of-range reads", () => {
    const snapshot = normalizeArtistKnowledge({ ...rawKnowledge, vault: [vault] });
    const source = snapshot.sources[0].metadata;
    const input = {
      operation: "read" as const,
      sourceId: source.sourceId,
      revision: source.revision,
      start: 0,
      maxChars: 1000,
    };
    expect(() =>
      queryArtistKnowledge(
        normalizeArtistKnowledge({
          ...rawKnowledge,
          vault: [{ ...vault, extractedText: "Changed" }],
        }),
        input,
      ),
    ).toThrow(/revision/i);
    expect(() => queryArtistKnowledge(normalizeArtistKnowledge(rawKnowledge), input)).toThrow(
      /unavailable/i,
    );
    expect(() => queryArtistKnowledge(snapshot, { ...input, start: 1_000_000 })).toThrow(/window/i);
  });

  it("keeps the actual match inside a reduced-budget search window", () => {
    const text =
      "ordinary prose ".repeat(95) +
      "The vibraphone was borrowed, not owned. " +
      "more prose ".repeat(100);
    const snapshot = normalizeArtistKnowledge({
      ...rawKnowledge,
      vault: [{ ...vault, extractedText: text }],
    });
    const result = queryArtistKnowledge(snapshot, {
      operation: "search",
      query: "vibraphone",
      limit: 1,
      maxChars: 1000,
    });
    expect(result.passages[0].text).toContain("vibraphone was borrowed, not owned");
  });

  it("binds pagination to artist, filter, operation and current ordered evidence", () => {
    const snapshot = normalizeArtistKnowledge({
      ...rawKnowledge,
      vault: [vault, { ...vault, id: "ffffffff-ffff-4fff-8fff-ffffffffffff" }],
    });
    const first = queryArtistKnowledge(snapshot, { operation: "sources", limit: 1 });
    const cursor = first.budget.nextCursor!;
    expect(
      queryArtistKnowledge(snapshot, { operation: "sources", limit: 1, cursor }).sources[0]
        .sourceId,
    ).not.toBe(first.sources[0].sourceId);
    expect(() =>
      queryArtistKnowledge(
        { ...snapshot, artist: { ...snapshot.artist, id: "other" } },
        { operation: "sources", limit: 1, cursor },
      ),
    ).toThrow(/cursor|corpus/i);
    expect(() =>
      queryArtistKnowledge(snapshot, { operation: "sources", limit: 1, kind: "vault", cursor }),
    ).toThrow(/cursor|corpus/i);
    expect(() =>
      queryArtistKnowledge(
        { ...snapshot, sources: snapshot.sources.slice(1) },
        { operation: "sources", limit: 1, cursor },
      ),
    ).toThrow(/corpus/i);
    expect(() =>
      queryArtistKnowledge(snapshot, { operation: "research-status", limit: 1, cursor }),
    ).toThrow(/cursor|corpus/i);
    expect(() =>
      queryArtistKnowledge(snapshot, { operation: "sources", limit: 1, cursor: "garbage" }),
    ).toThrow(/cursor/i);
  });

  it("restores exact corrections before old history, distinguishes pending from skipped and pins latest saved answer", () => {
    const snapshot = normalizeArtistKnowledge({
      ...rawKnowledge,
      corrections: [correction],
      answers: [
        answer,
        {
          ...answer,
          id: "offer",
          answer: null,
          source: "offered",
          sitting: 2,
          offeredAt: "2026-10-03T00:00:00Z",
        },
        { ...answer, id: "skip", answer: null, source: "interview", sitting: 2, offeredAt: null },
      ],
    });
    const history = queryArtistKnowledge(snapshot, {
      operation: "history",
      kind: "all",
      limit: 20,
      maxChars: 12000,
    });
    expect(history.entries[0].fields.map(f => f.text)).toEqual([
      correction.claim,
      correction.correction,
    ]);
    expect(history.entries.map(e => e.answerState)).toEqual([
      null,
      "offered",
      "answered",
      "skipped",
    ]);
    expect(history.entries.at(-1)?.offeredAt).toBeNull();
    expect(history.memory).toEqual({
      boundaryState: "not_implemented",
      latestAnswer: { entryId: `answer:${answer.id}`, revision: history.entries[2].revision },
    });
    expect(history.constraintsComplete).toBe(false);
    expect(history.correctionsComplete).toBe(true);
    const sitting = queryArtistKnowledge(snapshot, {
      operation: "history",
      kind: "all",
      limit: 20,
      maxChars: 12000,
      sitting: 2,
    });
    expect(sitting.entries).toHaveLength(3);
    expect(sitting.memory.latestAnswer).toEqual(history.memory.latestAnswer);
    const answersOnly = queryArtistKnowledge(snapshot, {
      operation: "history",
      kind: "answers",
      limit: 20,
      maxChars: 12000,
    });
    expect(answersOnly.correctionsComplete).toBe(false);
  });

  it("recovers every exact long field across new stateless requests and invalidates an edited correction", () => {
    const original = {
      ...rawKnowledge,
      corrections: [{ ...correction, claim: "A ".repeat(1500), correction: "🎹".repeat(2500) }],
      answers: [{ ...answer, answer: "Exact words. ".repeat(2000) }],
    };
    const recovered = new Map<string, string>();
    let cursor: string | undefined;
    let pages = 0;
    do {
      const response = queryArtistKnowledge(normalizeArtistKnowledge(structuredClone(original)), {
        operation: "history",
        kind: "all",
        limit: 20,
        maxChars: 1000,
        cursor,
      });
      expect(response.budget.returnedChars).toBeLessThanOrEqual(1000);
      for (const entry of response.entries)
        for (const field of entry.fields) {
          const key = `${entry.entryId}/${field.field}`;
          const previous = recovered.get(key) ?? "";
          expect(field.start).toBe(previous.length);
          expect(field.text?.isWellFormed()).toBe(true);
          recovered.set(key, previous + (field.text ?? ""));
        }
      if (pages === 0) {
        expect(response.correctionsComplete).toBe(false);
        const changed = {
          ...original,
          corrections: [{ ...original.corrections[0], correction: "Corrected again" }],
        };
        expect(() =>
          queryArtistKnowledge(normalizeArtistKnowledge(changed), {
            operation: "history",
            kind: "all",
            limit: 20,
            maxChars: 1000,
            cursor: response.budget.nextCursor!,
          }),
        ).toThrow(/corpus/i);
      }
      cursor = response.budget.nextCursor ?? undefined;
      expect(++pages).toBeLessThan(50);
    } while (cursor);
    expect([...recovered.values()]).toEqual([
      original.corrections[0].claim,
      original.corrections[0].correction,
      answer.question,
      original.answers[0].answer,
    ]);
  });

  it("labels and bounds the brief and sanitizes failed job status", () => {
    const snapshot = normalizeArtistKnowledge({
      ...rawKnowledge,
      artist: { ...rawKnowledge.artist, bio: "b".repeat(5000) },
      summary: { text: "s".repeat(5000), sourceKey: "private" },
      jobs: [
        {
          id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
          artistId,
          kind: "social_ingest",
          status: "failed",
          cursor: 1,
          total: 2,
          updatedAt: "2026-10-01T00:00:00Z",
        },
      ],
    });
    expect(queryArtistKnowledge(snapshot, { operation: "brief" })).toMatchObject({
      summaryIsEvidence: false,
      historyRequired: true,
      returnedChars: 6000,
      truncated: true,
    });
    expect(
      queryArtistKnowledge(snapshot, { operation: "research-status", limit: 20 }).jobs[0],
    ).toMatchObject({ errorCategory: "research_failed" });
  });
});
