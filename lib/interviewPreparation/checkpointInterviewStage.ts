import { InterviewStageComplete } from "./InterviewStageComplete";
import type { StageCache } from "./preparationTypes";
/** Reuse completed stages; yield after each newly completed paid operation. */
export async function checkpointInterviewStage<T>(
  cache: StageCache,
  key: string,
  run: () => Promise<T>,
): Promise<T> {
  if (Object.prototype.hasOwnProperty.call(cache, key)) return cache[key] as T;
  cache[key] = await run();
  throw new InterviewStageComplete();
}
