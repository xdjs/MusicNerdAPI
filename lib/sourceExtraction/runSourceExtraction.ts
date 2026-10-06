import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";
import type { ResearchJob, SliceOutcome } from "@/lib/research/types";
import { sourceExtractionSchemas } from "@/lib/sourceExtraction/sourceExtractionSchemas";
import { fetchSourceText } from "@/lib/sourceExtraction/fetchSourceText";
import { checkSourceExtractionSlice } from "@/lib/sourceExtraction/checkSourceExtractionSlice";
import { checkpointSourceExtraction } from "@/lib/sourceExtraction/checkpointSourceExtraction";

/** Attempt one missing original per slice; resume exclusively from persisted state. */
export async function runSourceExtraction(
  job: ResearchJob,
  deadline: number,
): Promise<SliceOutcome> {
  const parsed = sourceExtractionSchemas.state.safeParse(job.state);
  if (
    !parsed.success ||
    job.cursor < 0 ||
    job.cursor > parsed.data.sources.length ||
    parsed.data.outcomes.length !== job.cursor ||
    new Set(parsed.data.sources.map(s => s.id)).size !== parsed.data.sources.length
  )
    throw new Error("Invalid source extraction state");
  try {
    const state = parsed.data;
    if (deadline - Date.now() < 1000 || job.cursor === state.sources.length)
      return await checkpointSourceExtraction(job, state, null);
    const permission = await checkSourceExtractionSlice(job, state);
    if (permission === "stale")
      return { progress: "Slice no longer owns this job", done: false, waiting: true };
    if (permission === "changed")
      return await checkpointSourceExtraction(job, state, {
        status: "skipped",
        capturedAt: new Date().toISOString(),
        httpStatus: null,
        truncated: false,
      });
    const result = await fetchSourceText(
      state.sources[job.cursor].url,
      Math.min(15_000, deadline - Date.now()),
    );
    return await checkpointSourceExtraction(job, state, result);
  } catch (error) {
    if (error instanceof OwnershipChangedError) throw error;
    throw new Error("Source extraction persistence unavailable");
  }
}
