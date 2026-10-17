import { beforeEach, expect, it, vi } from "vitest";
import { revalidateInterviewBank } from "../revalidateInterviewBank";
import { InterviewStageComplete } from "../InterviewStageComplete";
import type { PreparationState } from "../preparationTypes";
const mocks = vi.hoisted(() => ({
  memory: vi.fn(),
  history: vi.fn(),
  validate: vi.fn(),
  generate: vi.fn(),
}));
vi.mock("@/lib/db/db", () => ({ db: { transaction: (fn: (tx: unknown) => unknown) => fn({}) } }));
vi.mock("@/lib/interviewSessions/validateInterviewOfferReferences", () => ({
  validateInterviewOfferReferences: mocks.validate,
}));
vi.mock("../fetchMandatoryInterviewMemory", () => ({
  fetchMandatoryInterviewMemory: mocks.memory,
}));
vi.mock("../fetchInterviewQuestionIndex", () => ({ fetchInterviewQuestionIndex: mocks.history }));
vi.mock("../generateInterviewText", () => ({ generateInterviewText: mocks.generate }));
const config = { artistId: "artist", userId: "user" };
const state = () =>
  ({
    memorySnapshotId: "current",
    sitting: 1,
    cache: {},
    bank: [0, 1].map(i => ({
      status: "available",
      candidate: { question: `Question ${i}?`, references: [] },
    })),
  }) as unknown as PreparationState;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.memory.mockResolvedValue({ snapshotId: "current", entries: [], constraintsComplete: true });
  mocks.history.mockResolvedValue([]);
  mocks.validate.mockResolvedValue(undefined);
  mocks.generate.mockResolvedValue({
    output: {
      decisions: [
        { index: 0, eligible: false },
        { index: 1, eligible: true },
      ],
    },
  });
});
it("retains a still-unanswered bank question and removes only the semantically covered one", async () => {
  const value = state();
  await expect(
    revalidateInterviewBank(config, value, AbortSignal.timeout(1000)),
  ).rejects.toBeInstanceOf(InterviewStageComplete);
  await revalidateInterviewBank(config, value, AbortSignal.timeout(1000));
  expect(value.bank!.map(item => item.status)).toEqual(["invalid", "available"]);
  expect(mocks.generate).toHaveBeenCalledTimes(1);
  expect(mocks.validate).toHaveBeenCalledTimes(1);
});
it("does not accept an incomplete or duplicate model eligibility decision", async () => {
  const value = state();
  value.cache.bankEligibility = {
    decisions: [
      { index: 0, eligible: true },
      { index: 0, eligible: true },
    ],
  };
  await expect(revalidateInterviewBank(config, value, AbortSignal.timeout(1000))).rejects.toThrow(
    "Incomplete",
  );
  expect(mocks.validate).not.toHaveBeenCalled();
});
it("fails closed when memory changed during checking", async () => {
  const value = state();
  value.cache.bankEligibility = {
    decisions: [
      { index: 0, eligible: true },
      { index: 1, eligible: true },
    ],
  };
  mocks.memory
    .mockResolvedValueOnce({ snapshotId: "current" })
    .mockResolvedValueOnce({ snapshotId: "changed" });
  await expect(
    revalidateInterviewBank(config, value, AbortSignal.timeout(1000)),
  ).rejects.toMatchObject({ code: "preparation_stale" });
});
