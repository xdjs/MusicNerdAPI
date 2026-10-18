import { beforeEach, it, expect, vi } from "vitest";
import { generateApiInterviewQuestion } from "../generateApiInterviewQuestion";
const m = vi.hoisted(() => ({
  memory: vi.fn(),
  index: vi.fn(),
  snapshot: vi.fn(),
  context: vi.fn(),
  draft: vi.fn(),
  resolve: vi.fn(),
  check: vi.fn(),
  write: vi.fn(),
}));
vi.mock("../fetchMandatoryInterviewMemory", () => ({ fetchMandatoryInterviewMemory: m.memory }));
vi.mock("../fetchInterviewQuestionIndex", () => ({ fetchInterviewQuestionIndex: m.index }));
vi.mock("@/lib/knowledge/loadArtistKnowledge", () => ({ loadArtistKnowledge: m.snapshot }));
vi.mock("../fetchInterviewArtistContext", () => ({ fetchInterviewArtistContext: m.context }));
vi.mock("../prepareArtistQuestion", () => ({ prepareArtistQuestion: m.draft }));
vi.mock("../resolveInterviewAnchors", () => ({ resolveInterviewAnchors: m.resolve }));
vi.mock("../checkSpokenQuestion", async importOriginal => ({
  ...(await importOriginal<typeof import("../checkSpokenQuestion")>()),
  checkSpokenQuestion: m.check,
}));
vi.mock("../generateInterviewText", () => ({ generateInterviewText: m.write }));
vi.mock("../checkpointInterviewStage", () => ({
  checkpointInterviewStage: (_cache: unknown, _key: string, run: () => unknown) => run(),
}));
vi.mock("../createInterviewKnowledgeTools", () => ({
  createInterviewKnowledgeTools: () => ({
    tools: {},
    originals: [],
    history: [],
    diagnostics: { calls: 0, returnedChars: 0 },
  }),
}));
vi.mock("../createInterviewEvidenceTool", () => ({
  createInterviewEvidenceTool: () => ({ tool: {}, validated: new Set() }),
}));
const scope = { artistId: "artist", userId: "claimant" };
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
beforeEach(() => {
  vi.clearAllMocks();
  m.memory.mockResolvedValue({ snapshotId: "same", constraintsComplete: true, entries: [] });
  m.index.mockResolvedValue([]);
  m.snapshot.mockResolvedValue({});
  m.context.mockResolvedValue({ originals: [] });
  m.draft.mockResolvedValue({
    candidate: {
      question: "What do you remember about that recording?",
      references: [{ kind: "answer", quote: "Exact answer words" }],
    },
    originals: [],
    usage: {},
  });
  m.resolve.mockReturnValue([{ reference: { kind: "answer", quote: "Exact answer words" } }]);
  m.check.mockResolvedValue({ output: verdict, usage: {} });
  m.write.mockResolvedValue({
    output: {
      question: "What was the first session like?",
      references: [{ kind: "answer", quote: "New exact words" }],
    },
    usage: {},
  });
});
it("rejects ungrounded references before asking the checker", async () => {
  m.resolve.mockImplementation(() => {
    throw new Error("Interview quote is missing or ambiguous");
  });
  await expect(generateApiInterviewQuestion(scope, 1)).rejects.toThrow("quote");
  expect(m.check).not.toHaveBeenCalled();
});
it("never returns a question rejected by the spoken guard after one repair", async () => {
  m.check.mockResolvedValue({
    output: { ...verdict, supported: false, reason: "Wrong collaborator." },
    usage: {},
  });
  await expect(generateApiInterviewQuestion(scope, 1)).rejects.toThrow("did not pass");
  expect(m.check).toHaveBeenCalledTimes(2);
  expect(m.write).toHaveBeenCalledTimes(1);
});
it("reuses reads only within an invocation while still rechecking memory before return", async () => {
  const invocation = {};
  await generateApiInterviewQuestion(
    scope,
    1,
    undefined,
    undefined,
    undefined,
    undefined,
    {},
    invocation,
  );
  await generateApiInterviewQuestion(
    scope,
    1,
    undefined,
    undefined,
    undefined,
    undefined,
    {},
    invocation,
  );
  expect(m.memory).toHaveBeenCalledTimes(3);
  expect(m.index).toHaveBeenCalledTimes(1);
  expect(m.snapshot).toHaveBeenCalledTimes(1);
});
it("rejects a changed mandatory snapshot after a successful guard", async () => {
  m.memory
    .mockResolvedValueOnce({ snapshotId: "before", constraintsComplete: true, entries: [] })
    .mockResolvedValueOnce({ snapshotId: "after", constraintsComplete: true, entries: [] });
  await expect(generateApiInterviewQuestion(scope, 1)).rejects.toThrow("memory changed");
});

it("resolves replacement anchors again when repairing a rejected question", async () => {
  m.check
    .mockResolvedValueOnce({
      output: { ...verdict, supported: false, reason: "Change the factual basis." },
      usage: {},
    })
    .mockResolvedValueOnce({ output: verdict, usage: {} });
  await generateApiInterviewQuestion(scope, 1);
  expect(m.resolve).toHaveBeenLastCalledWith(
    [{ kind: "answer", quote: "New exact words" }],
    [],
    expect.any(Object),
    [],
  );
});
