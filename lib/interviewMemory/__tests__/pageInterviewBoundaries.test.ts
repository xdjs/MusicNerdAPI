import { expect, it } from "vitest";
import { pageInterviewBoundaries } from "@/lib/interviewMemory/pageInterviewBoundaries";
const boundaries = Array.from({ length: 50 }, (_, i) => ({
  id: `boundary-${i}`,
  revision: String(i).padStart(64, "0"),
  wording: ` ${"🥁".repeat(1998)} ${i % 10} `,
  scope: "until_retracted" as const,
  sitting: 1,
  questionKey: "question",
  question: "What shaped the sound?",
  createdAt: "2026-10-01T00:00:00.000Z",
  retractedAt: null,
}));
const snapshot = { artistId: "artist", sitting: 2, boundaries };
it("pages every exact instruction beyond the model memory budget without truncation", () => {
  const collected = [];
  let cursor: string | undefined;
  do {
    const page = pageInterviewBoundaries(snapshot, cursor);
    expect(page.boundaries.length).toBeLessThanOrEqual(5);
    collected.push(...page.boundaries);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  expect(collected).toEqual(boundaries);
  expect(JSON.stringify(collected).length).toBeGreaterThan(32000);
});
it("rejects changed instructions, retractions, artist and sitting scope", () => {
  const cursor = pageInterviewBoundaries(snapshot).nextCursor!;
  for (const changed of [
    { ...snapshot, artistId: "other" },
    { ...snapshot, sitting: 3 },
    { ...snapshot, boundaries: boundaries.slice(1) },
    {
      ...snapshot,
      boundaries: [{ ...boundaries[0], revision: "f".repeat(64) }, ...boundaries.slice(1)],
    },
  ])
    expect(() => pageInterviewBoundaries(changed, cursor)).toThrow(/changed/);
});
it("rejects malformed cursor positions and distinguishes a valid empty list", () => {
  const cursor = pageInterviewBoundaries(snapshot).nextCursor!;
  const value = JSON.parse(Buffer.from(cursor, "base64url").toString());
  value[2] = [999, 0, 0];
  expect(() =>
    pageInterviewBoundaries(snapshot, Buffer.from(JSON.stringify(value)).toString("base64url")),
  ).toThrow(/cursor/);
  expect(pageInterviewBoundaries({ ...snapshot, boundaries: [] })).toEqual({
    status: "ok",
    sitting: 2,
    boundaries: [],
    nextCursor: null,
  });
});
