import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { authorizeLockedArtistWrite } from "@/lib/ownership/authorizeLockedArtistWrite";
import type { ResearchJob, SliceOutcome } from "@/lib/research/types";
import type { ExtractionState, FetchedSource } from "@/lib/sourceExtraction/types";
import { sourceExtractionSchemas } from "@/lib/sourceExtraction/sourceExtractionSchemas";

/** Atomically store an original and its outcome, then advance/release the durable job. */
export async function checkpointSourceExtraction(
  job: ResearchJob,
  state: ExtractionState,
  result: FetchedSource | null,
): Promise<SliceOutcome> {
  return db.transaction(async tx => {
    await lockArtistRow(tx, job.artistId);
    await authorizeLockedArtistWrite(tx, job.artistId, {
      userId: state.userId,
      expectedClaimId: state.expectedClaimId,
    });
    const current = await tx.execute(
      sql`select id from artist_research_jobs where id=${job.id}::uuid and artist_id=${job.artistId}::uuid and kind='source_extract' and status='running' and cursor=${job.cursor} and updated_at is not distinct from ${job.updatedAt}::timestamptz for update`,
    );
    if (!current.length)
      return { progress: "Slice no longer owns this job", done: false, waiting: true };
    const source = state.sources[job.cursor];
    if (result && !source) throw new Error("Invalid source extraction cursor");
    let next = state;
    let cursor = job.cursor;
    if (result && source) {
      let storedChars = 0;
      let status = result.status;
      if (status === "ready" && result.text?.trim()) {
        const rows = await tx.execute(
          sql`update artist_vault_sources set extracted_text=${result.text},updated_at=now() where id=${source.id}::uuid and artist_id=${job.artistId}::uuid and status='approved' and file_path is null and url=${source.url} and coalesce(extracted_text,'')='' returning id`,
        );
        if (rows.length) storedChars = result.text.length;
        else status = "skipped";
      }
      const outcome = sourceExtractionSchemas.outcome.parse({
        sourceId: source.id,
        status,
        capturedAt: result.capturedAt,
        httpStatus: result.httpStatus,
        storedChars,
        truncated: storedChars > 0 && result.truncated,
      });
      next = { ...state, outcomes: [...state.outcomes, outcome] };
      cursor++;
    }
    const done = cursor >= state.sources.length;
    await tx.execute(
      sql`update artist_research_jobs set cursor=${cursor},total=${state.sources.length},state=${JSON.stringify(next)}::jsonb,status=${done ? "done" : "pending"},claimed_at=null,attempts=0,last_error=null,updated_at=now() where id=${job.id}::uuid`,
    );
    return {
      progress: `${cursor}/${state.sources.length} sources attempted`,
      done,
      ...(!result && !done ? { waiting: true } : {}),
    };
  });
}
