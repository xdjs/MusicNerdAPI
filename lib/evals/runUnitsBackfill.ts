import { describeEvalError } from "@/lib/evals/describeEvalError";
import { ingestSource } from "@/lib/units/ingestSource";
import { listArtistUnitSources } from "@/lib/units/listArtistUnitSources";
import type { UnitSyncEntry } from "@/lib/units/types";

export type UnitsBackfillCounts = {
  sources: number;
  ingested: number;
  failed: number;
  unitsWritten: number;
  /** Sources ingested this run whose units were written without vectors. */
  embeddedFalse: number;
  /** Sources this run found to have no text, or no longer found: nothing to index. */
  noText: number;
  /** Sources still stale or missing vectors after the run, other than `noText` ones. */
  stale: number;
  /** Why sources failed, counted by safe reason string: no titles or text. */
  reasons: Record<string, number>;
};

/** A source the index does not yet hold in full: at another revision, or with units lacking vectors. */
const needsWork = (e: UnitSyncEntry) =>
  e.sourceRevision !== null && (e.indexedRevision !== e.sourceRevision || e.needsEmbedding);
const keyOf = (e: UnitSyncEntry) => `${e.sourceKind}:${e.sourceId}`;

/**
 * The units-backfill suite's work for one artist: ingest, with OCR, every source whose indexed
 * revision is not its current one or whose units lack embeddings (re-ingesting it embeds it again),
 * then list the sources again and count what is still stale. Counts only: no text, ids or titles.
 *
 * @param artistId - The artist.
 * @param opts.blocked - True once the eval's request budget is spent; remaining sources count as failed.
 * @returns The counts; `stale` is 0 when the index is complete.
 */
export async function runUnitsBackfill(
  artistId: string,
  opts: { blocked: () => boolean },
): Promise<UnitsBackfillCounts> {
  const entries = await listArtistUnitSources(artistId);
  const counts = { ingested: 0, failed: 0, unitsWritten: 0, embeddedFalse: 0, noText: 0 };
  const empty = new Set<string>();
  const reasons = new Map<string, number>();
  const note = (reason: string) => reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
  for (const e of entries.filter(needsWork)) {
    if (opts.blocked()) {
      counts.failed += 1;
      note("budget blocked");
      continue;
    }
    try {
      const outcome = await ingestSource(
        { sourceKind: e.sourceKind, sourceId: e.sourceId },
        { ocr: true, pdfTimeoutMs: 45_000, signal: AbortSignal.timeout(50_000) },
      );
      counts.unitsWritten += outcome.units;
      // A failed read can also report no text (every vision read failed): it stays stale.
      if (outcome.failed) {
        counts.failed += 1;
        note(String(outcome.failed));
      } else if (outcome.skipped === "no-text" || outcome.skipped === "not-found") {
        counts.noText += 1;
        empty.add(keyOf(e));
      } else {
        counts.ingested += 1;
        if (outcome.units > 0 && !outcome.embedded) counts.embeddedFalse += 1;
      }
    } catch (error) {
      counts.failed += 1;
      note(describeEvalError(error));
    }
  }
  const after = await listArtistUnitSources(artistId);
  const stale = after.filter(e => needsWork(e) && !empty.has(keyOf(e))).length;
  return { sources: entries.length, ...counts, stale, reasons: Object.fromEntries(reasons) };
}
