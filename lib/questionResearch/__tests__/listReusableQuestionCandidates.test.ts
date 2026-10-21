import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import { listReusableQuestionCandidates } from "@/lib/questionResearch/listReusableQuestionCandidates";
const m = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute: m.execute } }));
const artist = "11111111-1111-4111-8111-111111111111";
const refs = Array.from({ length: 6 }, (_, i) => ({
  sourceId: `vault:${String(i + 1).repeat(8)}-1111-4111-8111-111111111111`,
  revision: "a".repeat(64),
  start: 0,
  end: 12,
  text: "Source text.",
  url: `https://artist.example/${i + 1}`,
  curation: "approved",
  evidenceKind: "original_text",
  speaker: "unverified",
  publishedAt: null,
  retrievedAt: null,
  truncated: false,
}));
const row = {
  job_id: "22222222-2222-4222-8222-222222222222",
  question_hash: "a".repeat(64),
  answer_intent: "What instruments did they play?",
  routing: {},
  answer: "They played instruments. [4, 6]",
  refs,
  sources: refs.map((ref, i) => ({ n: i + 1, sourceId: ref.sourceId })),
  basis: refs.map(ref => ({
    ...ref,
    textHash: createHash("sha256").update(ref.text).digest("hex"),
  })),
};
beforeEach(() => vi.resetAllMocks());
it("keeps all allowed public evidence when considering a six-source saved answer for reuse", async () => {
  m.execute.mockResolvedValueOnce([row]);
  const candidates = await listReusableQuestionCandidates(artist);
  expect(candidates).toHaveLength(1);
  expect(candidates[0].passages.map(p => p.url)).toEqual(refs.map(ref => ref.url));
});
it("still rejects candidates with more than six sources", async () => {
  m.execute.mockResolvedValueOnce([{ ...row, sources: [...row.sources, row.sources[0]] }]);
  expect(await listReusableQuestionCandidates(artist)).toEqual([]);
});
it("keeps server continuation state out of semantic planner candidates", async () => {
  m.execute.mockResolvedValueOnce([
    { ...row, routing: { topic: "Influences", reuseFallbackJobId: row.job_id } },
  ]);
  expect((await listReusableQuestionCandidates(artist))[0].routing).toEqual({
    topic: "Influences",
  });
});
it("keeps cited support beyond the leading navigation excerpt, without uncited research windows", async () => {
  const text =
    "Page navigation. ".repeat(70) + "Their music was influenced by Lila and the Harbor Band.";
  const ref = { ...refs[0], text, end: text.length };
  m.execute.mockResolvedValueOnce([
    {
      ...row,
      refs: [ref, refs[1]],
      sources: [row.sources[0]],
      basis: [{ ...ref, textHash: createHash("sha256").update(text).digest("hex") }],
    },
  ]);
  const [candidate] = await listReusableQuestionCandidates(artist);
  expect(candidate.passages).toEqual([{ text, url: ref.url, evidenceKind: ref.evidenceKind }]);
});
it("fits whole cited windows within the original aggregate budget and skips oversized candidates", async () => {
  const large = refs.map(ref => ({ ...ref, text: "x".repeat(12000), end: 12000 }));
  const oversized = {
    ...row,
    refs: large,
    basis: large.map(ref => ({
      ...ref,
      textHash: createHash("sha256").update(ref.text).digest("hex"),
    })),
  };
  const medium = {
    ...oversized,
    refs: large.slice(0, 2),
    sources: row.sources.slice(0, 2),
    basis: oversized.basis.slice(0, 2),
  };
  m.execute.mockResolvedValueOnce([oversized, medium, medium, row]);
  const candidates = await listReusableQuestionCandidates(artist);
  expect(candidates).toHaveLength(2);
  expect(candidates.flatMap(c => c.passages).reduce((n, p) => n + p.text.length, 0)).toBe(24072);
});
it("omits a saved answer whose cited window no longer matches its verified text hash", async () => {
  m.execute.mockResolvedValueOnce([
    { ...row, refs: refs.map(ref => ({ ...ref, text: "Altered text" })) },
  ]);
  expect(await listReusableQuestionCandidates(artist)).toEqual([]);
});
