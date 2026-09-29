import { eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artistActivityEvents } from "@/lib/db/schema";
import { withArtistOperation } from "@/lib/ownership/withArtistOperation";
import { completeResearchJob } from "@/lib/research/completeResearchJob";
import { SOURCE_SEARCH_MIN_SLICE_MS } from "@/lib/research/const";
import { saveJobProgress } from "@/lib/research/saveJobProgress";
import type { ResearchJob, SliceOutcome } from "@/lib/research/types";
import { searchAndPopulateVault } from "@/lib/vault/searchAndPopulateVault";

/**
 * One `source_search` job: the source search a claim approval queued, run later
 * as the admin who approved it, under the claim it was queued for. The search
 * has no cursor, so it waits for a slice long enough to finish, and a failure
 * throws so the job retries rather than finishing partial.
 *
 * @param job - The claimed job; `activityId` names who started it.
 * @param deadline - When the slice must stop, in epoch milliseconds.
 * @returns What the slice did. Throws when attribution is missing or the search failed.
 */
export async function runSourceSearchJob(
  job: ResearchJob,
  deadline: number,
): Promise<SliceOutcome> {
  if (deadline - Date.now() < SOURCE_SEARCH_MIN_SLICE_MS) {
    await saveJobProgress(job.id, job.cursor);
    return { progress: "Waiting for a full research slice", done: false, waiting: true };
  }
  if (!job.activityId) throw new Error("Source research is missing its initiating event");
  const [event] = await db
    .select()
    .from(artistActivityEvents)
    .where(eq(artistActivityEvents.id, job.activityId))
    .limit(1);
  if (!event || event.artistId !== job.artistId) throw new Error("Invalid research attribution");
  if (event.actorKind === "user" && !event.actorUserId) {
    await completeResearchJob(job.id);
    return { progress: "Research cancelled: initiating account was deleted", done: true };
  }
  const sources = await withArtistOperation(
    job.artistId,
    {
      userId: event.actorUserId ?? undefined,
      expectedClaimId: typeof job.state.claimId === "string" ? job.state.claimId : null,
      trigger: event.trigger,
      activityId: event.id,
      sourceOrigin: "research",
    },
    () => searchAndPopulateVault(job.artistId, { deadline, requireComplete: true }),
  );
  await completeResearchJob(job.id);
  return { progress: `Source search finished, ${sources.length} sources added`, done: true };
}
