import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import type { ResearchJob, SliceOutcome } from "@/lib/research/types";
import { embedUnits } from "@/lib/units/embedUnits";
import { finishUnitSync } from "@/lib/units/finishUnitSync";
import { ingestSource } from "@/lib/units/ingestSource";
import { listArtistUnitSources } from "@/lib/units/listArtistUnitSources";
import { saveUnitSyncProgress } from "@/lib/units/saveUnitSyncProgress";
import { MIN_SOURCE_START_MS, UNIT_SYNC_SLICE_MS } from "@/lib/units/types";
import type { UnitSyncEntry } from "@/lib/units/types";

/** The PDF parse budget inside the job (Ruling R2); the upload path keeps its own, shorter one. */
const JOB_PDF_TIMEOUT_MS = 45_000;
/** Left after the parse for the rest of the source and the slice's own write. */
const PARSE_RESERVE_MS = 8_000;

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
 * A read cut short by the deadline writes nothing (`ingestSource` reports `skipped: "aborted"`); the
 * slice stops there and the next one reads the source again first (`state.retry`), this time with
 * `stampPartial`, so a document that cannot finish in one slice is stamped partial and counted as a
 * failure instead of looping. A vision read failed by the model writes the pages it read.
 *
 * @param job - The claimed job.
 * @param deadline - When the slice must stop, in epoch milliseconds.
 * @returns What the slice did; never document text.
 */
export async function runUnitSync(job: ResearchJob, deadline: number): Promise<SliceOutcome> {
  // The flag belongs to the row: the slice never writes it back, so only the database clears it.
  const { rescan: _rescan, retry: savedRetry, ...saved } = job.state;
  let after = savedKey(saved.after);
  // A source whose read was cut short last slice: read it again, once, before moving on.
  let retry = savedKey(savedRetry);
  let failures = typeof saved.failures === "number" ? saved.failures : 0;
  let handled = 0;
  let restarted = false;
  const sliceStart = Date.now();
  // A source started late would run past the deadline (Ruling R2, amended): wait for the next slice.
  // Past `UNIT_SYNC_SLICE_MS` the slice stops too, so jobs queued after a backfill get their turn;
  // the source in flight is still bounded by the deadline alone.
  const canStart = () =>
    Date.now() - sliceStart < UNIT_SYNC_SLICE_MS && deadline - Date.now() >= MIN_SOURCE_START_MS;

  for (;;) {
    const sources = await listArtistUnitSources(job.artistId);
    const total = sources.length;
    // Resume after the last source handled, by key: deleting orphans shifts every later position.
    const resumeAfter = after;
    const start = resumeAfter ? sources.findIndex(e => compareKeys(e, resumeAfter) > 0) : 0;
    let cursor = start === -1 ? total : start;

    let cutShort = false;
    while (cursor < total && canStart()) {
      const entry = sources[cursor];
      const key = { sourceKind: entry.sourceKind, sourceId: entry.sourceId };
      // The retry is spent here, or when its source has gone from the list.
      const stampPartial = retry !== null && compareKeys(entry, retry) === 0;
      if (retry && compareKeys(entry, retry) >= 0) retry = null;
      try {
        const result = await syncSource(entry, deadline, stampPartial);
        if (result === "aborted") {
          // Not stamped and not a failure: the next slice starts here and reads it whole.
          retry = key;
          cutShort = true;
          break;
        }
        if (result === "failed") failures++;
      } catch (error) {
        failures++;
        // Never the message: a failed query's message carries its bound parameters, which can be unit text.
        const code = (error as { cause?: { code?: unknown } } | null)?.cause?.code;
        console.warn(
          `[unit_sync] ${entry.sourceKind} source ${entry.sourceId} failed: ${error instanceof Error ? error.name : "unknown"}${typeof code === "string" ? ` ${code}` : ""}`,
        );
      }
      after = key;
      handled++;
      cursor++;
    }

    // `cursor` and `total` are display counters for this slice's list; `state.after` is the resume point.
    const state = { ...saved, failures, ...(after ? { after } : {}), ...(retry ? { retry } : {}) };
    const progress = `units ${cursor}/${total}, failures ${failures}`;
    if (cursor < total || cutShort) {
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

/** Sync one source; "failed" when it failed without throwing. Database errors propagate. */
async function syncSource(
  entry: UnitSyncEntry,
  deadline: number,
  stampPartial: boolean,
): Promise<"ok" | "failed" | "aborted"> {
  const { sourceKind, sourceId } = entry;
  const signal = AbortSignal.timeout(Math.max(1, deadline - Date.now()));
  if (entry.sourceRevision === null) {
    await db.execute(
      sql`delete from source_units where source_kind = ${sourceKind} and source_id = ${sourceId}::uuid`,
    );
    return "ok";
  }
  if (entry.indexedRevision !== entry.sourceRevision) {
    // The parse is bound to the deadline too: the platform kills the invocation past it.
    const pdfTimeoutMs = Math.min(JOB_PDF_TIMEOUT_MS, deadline - Date.now() - PARSE_RESERVE_MS);
    const outcome = await ingestSource(
      { sourceKind, sourceId },
      { pdfTimeoutMs, ocr: true, signal, stampPartial },
    );
    if (outcome.failed)
      console.warn(`[unit_sync] ${sourceKind} source ${sourceId} failed: ${outcome.failed}`);
    if (outcome.skipped === "aborted") return "aborted";
    return outcome.failed ? "failed" : "ok";
  }
  if (!entry.needsEmbedding) return "ok";

  const units = await db.execute<{ id: string; text: string }>(
    sql`select id::text as id, text from source_units where source_kind = ${sourceKind} and source_id = ${sourceId}::uuid and source_revision = ${entry.sourceRevision} and embedding is null order by unit_index`,
  );
  if (units.length === 0) return "ok";
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
  return "ok";
}
