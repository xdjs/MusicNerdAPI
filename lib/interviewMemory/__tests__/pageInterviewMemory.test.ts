import { it, expect } from "vitest";
import { pageInterviewMemory } from "@/lib/interviewMemory/pageInterviewMemory";
import type { MemorySnapshot } from "@/lib/interviewMemory/types";
const field = (name: string, text: string | null) => ({
  name,
  text,
  start: 0,
  end: text?.length ?? 0,
  totalChars: text?.length ?? 0,
  complete: true,
});
const snapshot: MemorySnapshot = {
  artistId: "artist",
  sitting: 2,
  entries: [
    {
      entryId: "answer:1",
      revision: "a".repeat(64),
      kind: "latest_answer",
      metadata: { questionKey: "q", sitting: 2 },
      fields: [
        field("question", "How did you make it?"),
        field("answer", "Exact 🥁 words. ".repeat(170)),
      ],
    },
    {
      entryId: "correction:1",
      revision: "b".repeat(64),
      kind: "correction",
      metadata: { correctionKind: "wrong" },
      fields: [field("claim", "I did not produce the track."), field("correction", null)],
    },
    {
      entryId: "boundary:1",
      revision: "c".repeat(64),
      kind: "boundary",
      metadata: { scope: "sitting", sitting: 2 },
      fields: [field("wording", "Leave my family out of this sitting.")],
    },
  ],
};
it("restores every exact field across bounded pages, preserving null corrections and surrogate pairs", () => {
  let cursor: string | undefined;
  const assembled = new Map<string, string | null>();
  let pages = 0;
  do {
    const p = pageInterviewMemory(snapshot, { maxChars: 1000, cursor });
    expect(p.budget.returnedChars).toBeLessThanOrEqual(1000);
    expect(p.latestAnswer?.entryId).toBe("answer:1");
    expect(p.constraintsComplete).toBe(false);
    for (const entry of p.entries)
      for (const f of entry.fields) {
        const key = entry.entryId + ":" + f.name;
        expect(f.start).toBe((assembled.get(key) ?? "").length);
        assembled.set(key, f.text === null ? null : (assembled.get(key) ?? "") + f.text);
      }
    cursor = p.budget.nextCursor ?? undefined;
    pages++;
  } while (cursor);
  expect(pages).toBeGreaterThan(1);
  for (const entry of snapshot.entries)
    for (const f of entry.fields) expect(assembled.get(entry.entryId + ":" + f.name)).toBe(f.text);
});
it("invalidates continuation when an answer or boundary changes", () => {
  const p = pageInterviewMemory(snapshot, { maxChars: 1000 });
  const changed = structuredClone(snapshot);
  changed.entries[2].revision = "d".repeat(64);
  expect(() =>
    pageInterviewMemory(changed, { maxChars: 1000, cursor: p.budget.nextCursor! }),
  ).toThrow();
});
it("distinguishes an empty complete memory from incomplete pages", () => {
  const p = pageInterviewMemory({ ...snapshot, entries: [] }, { maxChars: 1000 });
  expect(p).toMatchObject({
    constraintsComplete: true,
    totalEntries: 0,
    latestAnswer: null,
    budget: { nextCursor: null, returnedChars: 0 },
  });
});
