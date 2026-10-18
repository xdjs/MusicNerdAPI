import { beforeEach, expect, it, vi } from "vitest";
import { checkSpokenInterviewBank } from "../checkSpokenInterviewBank";
const mocks = vi.hoisted(() => ({ generate: vi.fn(), resolve: vi.fn() }));
vi.mock("../generateInterviewText", () => ({ generateInterviewText: mocks.generate }));
vi.mock("../resolveInterviewAnchors", () => ({ resolveInterviewAnchors: mocks.resolve }));
const verdict = {
  supported: true,
  timeScopeSupported: true,
  faithfulToLatestAnswer: true,
  respectsBoundaries: true,
  novelAgainstHistory: true,
  addsNewInformation: true,
  oneClearAsk: true,
  reason: "",
};
const draft = {
  candidates: [
    { question: "First?", references: [] },
    { question: "Second?", references: [] },
  ],
  originals: [{ passage: { source: { sourceId: "canonical" }, text: "Exact full saved passage" } }],
  usage: {},
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.resolve.mockReturnValue([
    { source: { sourceId: "canonical" }, reference: { quote: "Exact" } },
  ]);
});
it("checks each candidate against exact originals and shared boundaries/history in one checkpointable result", async () => {
  mocks.generate.mockResolvedValue({
    output: {
      checks: [
        { index: 0, ...verdict },
        { index: 1, ...verdict, supported: false, reason: "Unsupported premise" },
      ],
    },
    usage: { inputTokens: 12 },
  });
  const result = await checkSpokenInterviewBank(
    draft as never,
    { entries: [] } as never,
    [],
    new AbortController().signal,
  );
  expect(result.checks[1].supported).toBe(false);
  const prompt = JSON.parse(mocks.generate.mock.calls[0][0].prompt);
  expect(prompt.questions).toHaveLength(2);
  expect(prompt.questions[0].openedOriginals[0].passage.text).toBe("Exact full saved passage");
  expect(mocks.resolve).toHaveBeenCalledTimes(2);
  expect(mocks.generate.mock.calls[0][0].instructions).toContain(
    "semantically overlapping asks fail novelty",
  );
});
it("rejects misassociated model verdicts", async () => {
  mocks.generate.mockResolvedValue({
    output: {
      checks: [
        { index: 1, ...verdict },
        { index: 0, ...verdict },
      ],
    },
  });
  await expect(
    checkSpokenInterviewBank(
      draft as never,
      { entries: [] } as never,
      [],
      new AbortController().signal,
    ),
  ).rejects.toThrow("indices");
});
it("never calls the model if host quote resolution fails", async () => {
  mocks.resolve.mockImplementation(() => {
    throw new Error("quote missing");
  });
  await expect(
    checkSpokenInterviewBank(
      draft as never,
      { entries: [] } as never,
      [],
      new AbortController().signal,
    ),
  ).rejects.toThrow("quote missing");
  expect(mocks.generate).not.toHaveBeenCalled();
});
