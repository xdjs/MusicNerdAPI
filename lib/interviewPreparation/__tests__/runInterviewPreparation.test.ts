import { beforeEach, it, expect, vi } from "vitest";
import { runInterviewPreparation } from "../runInterviewPreparation";
import { InterviewStageComplete } from "../InterviewStageComplete";
import type { ResearchJob } from "@/lib/research/types";
const { read, checkpoint, generate } = vi.hoisted(() => ({
  read: vi.fn(),
  checkpoint: vi.fn(),
  generate: vi.fn(),
}));
vi.mock("@/lib/db/db", () => ({ db: { transaction: (fn: (tx: unknown) => unknown) => fn({}) } }));
vi.mock("../readPreparationScope", () => ({ readPreparationScope: read }));
vi.mock("../checkpointPreparationJob", () => ({ checkpointPreparationJob: checkpoint }));
vi.mock("../generateApiInterviewQuestion", () => ({ generateApiInterviewQuestion: generate }));
const uuid = "11111111-1111-4111-8111-111111111111";
const state = {
  version: 1,
  claimId: uuid,
  userId: uuid,
  sessionId: uuid,
  sitting: 1,
  ordinal: 1,
  memorySnapshotId: "a".repeat(64),
  stage: "preparing",
  cache: {},
  inFlight: false,
  createdAt: new Date().toISOString(),
};
const job = (): ResearchJob => ({
  id: uuid,
  artistId: uuid,
  kind: "interview_prepare",
  status: "running",
  cursor: 0,
  total: null,
  attempts: 0,
  state: structuredClone(state),
  updatedAt: new Date().toISOString(),
  activityId: null,
});
beforeEach(() => {
  vi.clearAllMocks();
  read.mockResolvedValue({ ...state, session: { questions: [] } });
  checkpoint.mockResolvedValue(true);
});
it("never starts paid work when memory has changed", async () => {
  read.mockResolvedValue({
    ...state,
    memorySnapshotId: "b".repeat(64),
    session: { questions: [] },
  });
  await runInterviewPreparation(job(), Date.now() + 50000);
  expect(generate).not.toHaveBeenCalled();
  expect(checkpoint.mock.calls[0][1].stage).toBe("stale");
});
it("fails closed after interrupted paid work rather than silently repeating it", async () => {
  const j = job();
  j.state.inFlight = true;
  await runInterviewPreparation(j, Date.now() + 50000);
  expect(generate).not.toHaveBeenCalled();
  expect(checkpoint.mock.calls[0][1].errorCode).toBe("external_outcome_unknown");
});
it("checkpoints and immediately advances the next stage without a polling gap", async () => {
  generate
    .mockRejectedValueOnce(new InterviewStageComplete())
    .mockResolvedValue({ question: "Checked?" });
  const result = await runInterviewPreparation(job(), Date.now() + 50000);
  expect(result).toMatchObject({ done: true, waiting: false });
  expect(generate).toHaveBeenCalledTimes(2);
  expect(checkpoint).toHaveBeenCalledTimes(4);
  expect(checkpoint.mock.calls[1][1].inFlight).toBe(false);
});
it("never generates after losing its lease", async () => {
  checkpoint.mockResolvedValue(false);
  await runInterviewPreparation(job(), Date.now() + 50000);
  expect(generate).not.toHaveBeenCalled();
});
it("holds a checked candidate without offering or writing an answer", async () => {
  generate.mockResolvedValue({ question: "A checked question?" });
  await runInterviewPreparation(job(), Date.now() + 50000);
  expect(checkpoint.mock.calls[1][1]).toMatchObject({
    stage: "ready",
    candidate: { question: "A checked question?" },
    inFlight: false,
  });
});
