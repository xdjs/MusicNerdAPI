import { it, expect } from "vitest";
import { pageInterviewMemory } from "@/lib/interviewMemory/pageInterviewMemory";
import { assembleInterviewMemory } from "@/lib/interviewMemory/assembleInterviewMemory";
import type { MemorySnapshot } from "@/lib/interviewMemory/types";
function pages(text: string) {
  const snapshot: MemorySnapshot = {
    artistId: "artist",
    sitting: 1,
    entries: [
      {
        entryId: "answer:1",
        revision: "a".repeat(64),
        kind: "latest_answer",
        metadata: { questionKey: "q" },
        fields: [
          { name: "question", text: "Question?", start: 0, end: 9, totalChars: 9, complete: true },
          {
            name: "answer",
            text,
            start: 0,
            end: text.length,
            totalChars: text.length,
            complete: true,
          },
        ],
      },
    ],
  };
  const all = [];
  let cursor: string | undefined;
  do {
    const p = pageInterviewMemory(snapshot, { maxChars: 1000, cursor });
    all.push(p);
    cursor = p.budget.nextCursor ?? undefined;
  } while (cursor);
  return all;
}
it("restores an exact latest answer only after every page is present", () => {
  const original = "Exact 🥁 answer. ".repeat(120);
  const p = pages(original);
  expect(assembleInterviewMemory(p).entries[0].fields.find(f => f.name === "answer")?.text).toBe(
    original,
  );
  expect(assembleInterviewMemory(p).constraintsComplete).toBe(true);
  expect(() => assembleInterviewMemory(p.slice(0, -1))).toThrow();
});
it("rejects a gap, a changed snapshot or a missing latest answer", () => {
  const p = pages("a".repeat(2400));
  const gap = structuredClone(p);
  gap[1].entries[0].fields[0].start++;
  expect(() => assembleInterviewMemory(gap)).toThrow();
  const changed = structuredClone(p);
  changed[1].snapshotId = "b".repeat(64);
  expect(() => assembleInterviewMemory(changed)).toThrow();
  const absent = structuredClone(p);
  absent[0].latestAnswer = { entryId: "answer:missing", revision: "a".repeat(64) };
  expect(() => assembleInterviewMemory(absent)).toThrow();
});
it("fails rather than trimming mandatory context beyond its fixed budget", () => {
  expect(() => assembleInterviewMemory(pages("a".repeat(33000)))).toThrow(/budget/);
});
