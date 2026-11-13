import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { completeResearchJob } from "@/lib/research/completeResearchJob";
import { saveJobProgress } from "@/lib/research/saveJobProgress";
import { saveJobState } from "@/lib/research/saveJobState";
import type { ResearchJob, SliceOutcome } from "@/lib/research/types";
import { embedUnits } from "@/lib/units/embedUnits";
import { ingestSource } from "@/lib/units/ingestSource";
import { listArtistUnitSources } from "@/lib/units/listArtistUnitSources";
import type { UnitSyncEntry } from "@/lib/units/types";

/** No source is started with less than this left before the slice deadline. */
const START_RESERVE_MS = 8_000;
/** The PDF parse budget inside the job (Ruling R2); the upload path keeps its own, shorter one. */
const JOB_PDF_TIMEOUT_MS = 45_000;

/**
 * One slice of a `unit_sync` job: bring the artist's page-level text index in line with their sources.
 *
 * Walks `listArtistUnitSources` from `job.cursor`: an orphan's units are deleted, a source whose
 * indexed revision differs from its current one is ingested with OCR, and a current source with
 * units lacking embeddings is re-embedded. A source that fails is counted in `state.failures` and
 * skipped, never stopping the slice. The cursor indexes a list rebuilt every slice; a source added
 * between slices can shift it by one, and the next queued sync catches what this one missed.
 *
 * A vision read cut short (by the deadline or a model error) writes the pages it read, stamped with
 * the current revision, so a later sync treats the source as indexed and does not retry it until
 * its revision changes. Accepted for v1.
 *
 * @param job - The claimed job.
 * @param deadline - When the slice must stop, in epoch milliseconds.
 * @returns What the slice did; never document text.
 */
export async function runUnitSync(job: ResearchJob, deadline: number): Promise<SliceOutcome> {
  const sources = await listArtistUnitSources(job.artistId);
  const total = sources.length;
  const start = Math.min(Math.max(job.cursor ?? 0, 0), total);
  let cursor = start;
  let failures = typeof job.state.failures === "number" ? job.state.failures : 0;

  while (cursor < total && Date.now() < deadline - START_RESERVE_MS) {
    const entry = sources[cursor];
    try {
      if (!(await syncSource(entry, deadline))) failures++;
    } catch (error) {
      failures++;
      console.warn(
        `[unit_sync] ${entry.sourceKind} source ${entry.sourceId} failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
    cursor++;
  }

  const state = { ...job.state, failures };
  const progress = `units ${cursor}/${total}, failures ${failures}`;
  if (cursor >= total) {
    // Keep the claim while writing the count, then finish, as `finishSocialIngest` does.
    await saveJobState(job.id, state);
    await completeResearchJob(job.id);
    return { progress, done: true };
  }
  await saveJobProgress(job.id, cursor, { total, state });
  // A slice too short to start one source waits for a longer one rather than spinning this tick.
  return cursor === start ? { progress, done: false, waiting: true } : { progress, done: false };
}

/** Sync one source; false when it failed without throwing. Database errors propagate. */
async function syncSource(entry: UnitSyncEntry, deadline: number): Promise<boolean> {
  const { sourceKind, sourceId } = entry;
  const signal = AbortSignal.timeout(Math.max(1, deadline - Date.now()));
  if (entry.sourceRevision === null) {
    await db.execute(
      sql`delete from source_units where source_kind = ${sourceKind} and source_id = ${sourceId}::uuid`,
    );
    return true;
  }
  if (entry.indexedRevision !== entry.sourceRevision) {
    const outcome = await ingestSource(
      { sourceKind, sourceId },
      { pdfTimeoutMs: JOB_PDF_TIMEOUT_MS, ocr: true, signal },
    );
    if (outcome.failed)
      console.warn(`[unit_sync] ${sourceKind} source ${sourceId} failed: ${outcome.failed}`);
    return !outcome.failed;
  }
  if (!entry.needsEmbedding) return true;

  const units = await db.execute<{ id: string; text: string }>(
    sql`select id::text as id, text from source_units where source_kind = ${sourceKind} and source_id = ${sourceId}::uuid and source_revision = ${entry.sourceRevision} and embedding is null order by unit_index`,
  );
  if (units.length === 0) return true;
  const embeddings = await embedUnits(
    units.map(u => u.text),
    { signal },
  );
  await db.transaction(async tx => {
    for (const [i, u] of units.entries())
      await tx.execute(
        sql`update source_units set embedding = ${JSON.stringify(embeddings[i])}::extensions.vector where id = ${u.id}::uuid`,
      );
  });
  return true;
}
