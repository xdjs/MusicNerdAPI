import { it, expect, vi, beforeEach } from "vitest";
import { generateInterviewQuestionBank } from "../generateInterviewQuestionBank";
const mocks = vi.hoisted(() => ({ context: vi.fn(), draft: vi.fn(), check: vi.fn() }));
vi.mock("../checkSpokenInterviewBank", () => ({
  checkSpokenInterviewBank: vi.fn().mockResolvedValue({ checks: [{}, {}, {}], usage: {} }),
}));
vi.mock("../fetchPreviouslyCitedInterviewSources", () => ({
  fetchPreviouslyCitedInterviewSources: vi.fn().mockResolvedValue(new Set()),
}));
vi.mock("@/lib/knowledge/loadArtistKnowledge", () => ({ loadArtistKnowledge: vi.fn() }));
vi.mock("../fetchMandatoryInterviewMemory", () => ({ fetchMandatoryInterviewMemory: vi.fn() }));
vi.mock("../fetchInterviewQuestionIndex", () => ({ fetchInterviewQuestionIndex: vi.fn() }));
vi.mock("../fetchInterviewArtistContext", () => ({ fetchInterviewArtistContext: mocks.context }));
vi.mock("../prepareArtistQuestion", () => ({ prepareArtistQuestion: mocks.draft }));
vi.mock("../generateApiInterviewQuestion", () => ({ generateApiInterviewQuestion: mocks.check }));
vi.mock("../checkpointInterviewStage", () => ({
  checkpointInterviewStage: async (
    cache: Record<string, unknown>,
    key: string,
    run: () => Promise<unknown>,
  ) => {
    if (!(key in cache)) cache[key] = await run();
    return cache[key];
  },
}));
beforeEach(() => vi.resetAllMocks());
it("uses a second distinct saved-context batch after exhausted topics, keeping all three independent guards", async () => {
  const first = {
    originals: [{ passage: { source: { sourceId: "first" } } }],
    coverage: { totalSources: 20 },
  };
  const expanded = {
    originals: [{ passage: { source: { sourceId: "unseen" } } }],
    coverage: { totalSources: 20 },
  };
  mocks.context.mockResolvedValueOnce(first).mockResolvedValueOnce(expanded);
  const candidates = [1, 2, 3].map(n => ({ question: `Distinct question ${n}`, references: [] }));
  mocks.draft
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ candidates, originals: expanded.originals, usage: {} });
  mocks.check.mockImplementation(async (...args) => args[6].context_question.candidate);
  const memory = { constraintsComplete: true, entries: [] },
    previousQuestions = [{ question: "Old question" }];
  const result = await generateInterviewQuestionBank(
    { artistId: "a", userId: "u" },
    2,
    3,
    new AbortController().signal,
    {},
    { memory, previousQuestions, artistSnapshot: {} } as never,
  );
  expect(result).toEqual(candidates);
  expect(mocks.context.mock.calls[1][2]).toEqual(new Set(["first"]));
  expect(mocks.draft.mock.calls[1][0]).toBe(memory);
  expect(mocks.draft.mock.calls[1][1]).toBe(previousQuestions);
  expect(mocks.check).toHaveBeenCalledTimes(3);
  expect(mocks.check.mock.calls.every(call => call[6].context_question)).toBe(true);
  expect(mocks.check.mock.calls[2][7].previousQuestions).toHaveLength(3);
});
