import { it, expect, vi } from "vitest";
import { checkpointInterviewStage } from "../checkpointInterviewStage";
import { InterviewStageComplete } from "../InterviewStageComplete";
import type { StageCache } from "../preparationTypes";
it("checkpoints each successful paid stage and never reruns it after worker restoration", async () => {
  const cache: StageCache = {};
  const paid = vi
    .fn()
    .mockResolvedValue({ output: { question: "A question" }, usage: { outputTokens: 10 } });
  await expect(checkpointInterviewStage(cache, "draft:0", paid)).rejects.toBeInstanceOf(
    InterviewStageComplete,
  );
  const restored = JSON.parse(JSON.stringify(cache));
  expect(await checkpointInterviewStage(restored, "draft:0", paid)).toEqual({
    output: { question: "A question" },
    usage: { outputTokens: 10 },
  });
  expect(paid).toHaveBeenCalledTimes(1);
});
it("does not cache failed output as a usable candidate", async () => {
  const cache: StageCache = {};
  const paid = vi.fn().mockRejectedValue(new Error("bad output"));
  await expect(checkpointInterviewStage(cache, "check:0", paid)).rejects.toThrow("bad output");
  expect(cache).toEqual({});
});
