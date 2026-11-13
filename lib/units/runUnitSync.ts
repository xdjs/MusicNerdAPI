import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import type { ResearchJob, SliceOutcome } from "@/lib/research/types";
import { embedUnits } from "@/lib/units/embedUnits";
import { finishUnitSync } from "@/lib/units/finishUnitSync";
import { ingestSource } from "@/lib/units/ingestSource";
import { listArtistUnitSources } from "@/lib/units/listArtistUnitSources";
import { saveUnitSyncProgress } from "@/lib/units/saveUnitSyncProgress";
import type { UnitSyncEntry } from "@/lib/units/types";

/** No source is started with less than this left before the slice deadline. */
const START_RESERVE_MS = 8_000;
/** The PDF parse budget inside the job (Ruling R2); the upload path keeps its own, shorter one. */
const JOB_PDF_TIMEOUT_MS = 45_000;

/**
 * One slice of a `unit_sync` job: bring the artist's page-level text index in line with their sources.
 *
 * Walks `listArtistUnitSources` from where the last slice stopped: an orphan's units are deleted, a source whose
 * indexed revision differs from its current one is ingested with OCR, and a current source with
 * units lacking embeddings is re-embedded. A source that fails is counted in `state.failures` and
 * skipped, never stopping the slice. The list is rebuilt every slice, so the slice resumes after the
 * last source handled (`state.after`, a kind and id), not at a position.
 *
 * A source queued while the job is live sets `state.rescan` (`queueUnitSync`); at the end of the list
 * the job then starts over from the top instead of finishing (once per slice; the database clears the
 * flag atomically, so a rescan that lands mid-slice is never lost).
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
  // The flag belongs to the row: the slice never writes it back, so only the database clears it.
  const { rescan: _rescan, ...saved } = job.state;
  let after = savedKey(saved.after);
  let failures = typeof saved.failures === "number" ? saved.failures : 0;
  let handled = 0;
  let restarted = false;
  const canStart = () => Date.now() < deadline - START_RESERVE_MS;

  for (;;) {
    const sources = await listArtistUnitSources(job.artistId);
    const total = sources.length;
    // Resume after the last source handled, by key: deleting orphans shifts every later position.
    const resumeAfter = after;
    const start = resumeAfter ? sources.findIndex(e => compareKeys(e, resumeAfter) > 0) : 0;
    let cursor = start === -1 ? total : start;

    while (cursor < total && canStart()) {
      const entry = sources[cursor];
      try {
        if (!(await syncSource(entry, deadline))) failures++;
      } catch (error) {
        failures++;
        // Never the message: a failed query's message carries its bound parameters, which can be unit text.
        const code = (error as { cause?: { code?: unknown } } | null)?.cause?.code;
        console.warn(
          `[unit_sync] ${entry.sourceKind} source ${entry.sourceId} failed: ${error instanceof Error ? error.name : "unknown"}${typeof code === "string" ? ` ${code}` : ""}`,
        );
      }
      after = { sourceKind: entry.sourceKind, sourceId: entry.sourceId };
      handled++;
      cursor++;
    }

    // `cursor` and `total` are display counters for this slice's list; `state.after` is the resume point.
    const state = { ...saved, failures, ...(after ? { after } : {}) };
    const progress = `units ${cursor}/${total}, failures ${failures}`;
    if (cursor < total) {
      await saveUnitSyncProgress(job.id, cursor, total, state);
      // A slice too short to start one source waits for a longer one rather than spinning this tick.
      return handled === 0 ? { progress, done: false, waiting: true } : { progress, done: false };
    }
    if (await finishUnitSync(job.id, state)) return { progress, done: true };
    // A rescan was pending: sources may have been added before the resume key. Start over.
    after = null;
    if (restarted || !canStart()) {
      const { after: _after, ...fromTop } = state;
      await saveUnitSyncProgress(job.id, 0, total, fromTop);
      return { progress: `units 0/${total}, failures ${failures}`, done: false };
    }
    restarted = true;
  }
}

type SourceKey = { sourceKind: string; sourceId: string };

/** The resume key saved in job state, or null when there is none (a fresh job). */
function savedKey(value: unknown): SourceKey | null {
  const key = value as Partial<SourceKey> | null | undefined;
  return typeof key?.sourceKind === "string" && typeof key.sourceId === "string"
    ? { sourceKind: key.sourceKind, sourceId: key.sourceId }
    : null;
}

/** Kind then id in byte order, matching `listArtistUnitSources`'s `collate "C"` ordering. */
function compareKeys(a: SourceKey, b: SourceKey): number {
  if (a.sourceKind !== b.sourceKind) return a.sourceKind < b.sourceKind ? -1 : 1;
  if (a.sourceId !== b.sourceId) return a.sourceId < b.sourceId ? -1 : 1;
  return 0;
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
