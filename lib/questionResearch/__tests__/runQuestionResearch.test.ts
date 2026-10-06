import { it, expect, vi, beforeEach } from "vitest";
import { runQuestionResearch } from "@/lib/questionResearch/runQuestionResearch";
import type { ResearchJob } from "@/lib/research/types";
const m = vi.hoisted(() => ({
  artist: vi.fn(),
  load: vi.fn(),
  select: vi.fn(),
  assess: vi.fn(),
  checkpoint: vi.fn(),
  start: vi.fn(),
  poll: vi.fn(),
  collect: vi.fn(),
  search: vi.fn(),
  fetch: vi.fn(),
  persist: vi.fn(),
  classify: vi.fn(),
}));
vi.mock("@/lib/questionResearch/loadResearchArtist", () => ({ loadResearchArtist: m.artist }));
vi.mock("@/lib/questionResearch/loadPublicResearchOriginals", () => ({
  loadPublicResearchOriginals: m.load,
}));
vi.mock("@/lib/questionResearch/selectResearchReferences", () => ({
  selectResearchReferences: m.select,
}));
vi.mock("@/lib/questionResearch/assessResearchEvidence", () => ({
  assessResearchEvidence: m.assess,
}));
vi.mock("@/lib/questionResearch/checkpointQuestionResearch", () => ({
  checkpointQuestionResearch: m.checkpoint,
}));
vi.mock("@/lib/questionResearch/startQuestionSocialRun", () => ({
  startQuestionSocialRun: m.start,
}));
vi.mock("@/lib/instagram/checkInstagramScrape", () => ({ checkInstagramScrape: m.poll }));
vi.mock("@/lib/questionResearch/collectQuestionSocialOriginals", () => ({
  collectQuestionSocialOriginals: m.collect,
}));
vi.mock("@/lib/questionResearch/persistResearchOriginals", () => ({
  persistResearchOriginals: m.persist,
}));
vi.mock("@/lib/questionResearch/classifyQuestionOriginal", () => ({
  classifyQuestionOriginal: m.classify,
}));
vi.mock("@/lib/search/webSearch", () => ({ webSearch: m.search }));
vi.mock("@/lib/sourceExtraction/fetchSourceText", () => ({ fetchSourceText: m.fetch }));
const initial = () => ({
  version: 1,
  request: { topic: "record credits", evidenceNeed: "credits", freshness: "stored" },
  key: "key",
  expectedClaimId: null,
  stage: "checking_saved",
  createdAt: new Date().toISOString(),
  references: [],
  limitations: [],
  modelCalls: 0,
  providerCalls: 0,
  inputTokens: 0,
  outputTokens: 0,
});
const job = (state: Record<string, unknown> = initial()) =>
  ({
    id: "job",
    artistId: "artist",
    kind: "question_research",
    status: "running",
    cursor: 0,
    total: null,
    attempts: 0,
    state,
    updatedAt: "2026-10-06T00:00:00Z",
    activityId: null,
  }) as unknown as ResearchJob;
beforeEach(() => {
  vi.resetAllMocks();
  m.artist.mockResolvedValue({ name: "Artist", tiktok: "artist" });
  m.load.mockResolvedValue([]);
  m.select.mockReturnValue([]);
  m.checkpoint.mockImplementation(async (j, s, _release, write) => {
    if (write) await write({});
    j.state = s;
    return true;
  });
  m.assess.mockResolvedValue({
    sufficient: false,
    references: [],
    confirmedIds: [],
    limitation: "missing_original",
    inputTokens: 0,
    outputTokens: 0,
  });
});
it("publishes the move beyond saved sources before starting a provider", async () => {
  const j = job();
  await runQuestionResearch(j, Date.now() + 50000);
  expect(j.state).toMatchObject({ stage: "searching", step: "search" });
  expect(m.search).not.toHaveBeenCalled();
});
it("finishes from read original evidence without external collection", async () => {
  m.select.mockReturnValue([{ sourceId: "vault:1", text: "exact original" }]);
  m.assess.mockResolvedValue({
    sufficient: true,
    references: [{ sourceId: "vault:1", text: "exact original" }],
    confirmedIds: [],
    limitation: "none",
    inputTokens: 30,
    outputTokens: 10,
  });
  const j = job();
  expect((await runQuestionResearch(j, Date.now() + 50000)).done).toBe(true);
  expect(j.state.stage).toBe("complete");
  expect(m.search).not.toHaveBeenCalled();
  expect(m.start).not.toHaveBeenCalled();
});
it("treats database failure as failure, never as missing evidence", async () => {
  m.load.mockRejectedValue(new Error("db unavailable"));
  const j = job();
  await runQuestionResearch(j, Date.now() + 50000);
  expect(j.state).toMatchObject({ stage: "failed", errorCode: "research_unavailable" });
  expect(m.search).not.toHaveBeenCalled();
});
it("never repeats an ambiguous paid start after a killed worker", async () => {
  const j = job({ ...initial(), step: "social_start", stage: "reading", inFlight: "social_start" });
  await runQuestionResearch(j, Date.now() + 50000);
  expect(j.state).toMatchObject({ stage: "failed", errorCode: "external_outcome_unknown" });
  expect(m.start).not.toHaveBeenCalled();
});
it("does not start a provider if its reservation loses the lease", async () => {
  m.checkpoint.mockResolvedValue(false);
  const j = job({
    ...initial(),
    request: {
      topic: "new video",
      evidenceNeed: "social_caption",
      freshness: "recent",
      platform: "tiktok",
    },
    step: "social_start",
    stage: "reading",
  });
  await runQuestionResearch(j, Date.now() + 50000);
  expect(m.start).not.toHaveBeenCalled();
});
it("polls only a saved actor run and does not repeat the start", async () => {
  m.poll.mockResolvedValue({ status: "running", runId: "run1" });
  const j = job({
    ...initial(),
    request: {
      topic: "new video",
      evidenceNeed: "social_caption",
      freshness: "recent",
      platform: "tiktok",
    },
    step: "social_poll",
    stage: "waiting_provider",
    runId: "run1",
  });
  await runQuestionResearch(j, Date.now() + 50000);
  expect(m.poll).toHaveBeenCalledWith("run1");
  expect(m.start).not.toHaveBeenCalled();
});
it("caps job lifetime and stops reporting ongoing work", async () => {
  const j = job({ ...initial(), createdAt: new Date(Date.now() - 16 * 60000).toISOString() });
  expect((await runQuestionResearch(j, Date.now() + 50000)).done).toBe(true);
  expect(j.state).toMatchObject({ stage: "failed", errorCode: "research_expired" });
  expect(m.load).not.toHaveBeenCalled();
});
it("does not spend provider polling budget when a foreground client resumes too quickly", async () => {
  m.poll.mockResolvedValue({ status: "running", runId: "run1" });
  const j = job({
    ...initial(),
    providerCalls: 1,
    request: {
      topic: "new video",
      evidenceNeed: "social_caption",
      freshness: "stored",
      platform: "tiktok",
    },
    step: "social_poll",
    stage: "waiting_provider",
    runId: "run1",
  });
  await runQuestionResearch(j, Date.now() + 50000);
  await runQuestionResearch(j, Date.now() + 50000);
  expect(m.poll).toHaveBeenCalledTimes(1);
  expect(j.state.providerCalls).toBe(2);
  expect(Date.parse(String(j.state.nextPollAt))).toBeGreaterThan(Date.now());
});
it("does not cancel when JSONB storage reorders a persisted provider plan", async () => {
  m.search.mockResolvedValue([]);
  const j = job({
    ...initial(),
    plan: {
      reason: "work_specific_originals",
      query: '"Artist" record credits credits liner notes official release',
      stage: "searching",
      provider: "web",
    },
    step: "search",
    stage: "searching",
  });
  await runQuestionResearch(j, Date.now() + 50000);
  expect(m.search).toHaveBeenCalledTimes(1);
  expect(j.state.stage).toBe("unresolved");
});
