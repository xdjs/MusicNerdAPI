import { createEvalBudgetFetch } from "@/lib/evals/createEvalBudgetFetch";
import { Eval } from "braintrust";
import { MODEL_EMBEDDING } from "@/lib/ai/const";
import { RETRIEVAL_CASES } from "@/lib/evals/retrievalCases";
import { experimentName } from "@/lib/evals/experimentName";
import { ingestSource } from "@/lib/units/ingestSource";
import { listArtistUnitSources } from "@/lib/units/listArtistUnitSources";

/**
 * One-time backfill of the page-level text index for the retrieval suite's artists, on the
 * staging database, once Web migration 0066 is applied there and before the `retrieval` suite.
 * Ingests every source whose indexed revision is not its current one, with OCR. Output is
 * counts only: no source text, ids or titles.
 *
 *   hosted: the Evals workflow, suite `units-backfill`
 */

const budget = createEvalBudgetFetch(globalThis.fetch);
globalThis.fetch = budget.fetch;

const SHA = process.env.GITHUB_SHA ?? "local";
const ARTISTS = [...new Set(RETRIEVAL_CASES.map(c => c.artistId))];

Eval("music-nerd", {
  experimentName: experimentName("units-backfill", MODEL_EMBEDDING, SHA),
  metadata: { suite: "units-backfill", embeddingModel: MODEL_EMBEDDING, sha: SHA },
  maxConcurrency: 1,
  data: () => ARTISTS.map(artistId => ({ input: { artistId }, metadata: { artistId } })),
  task: async (input: { artistId: string }) => {
    const entries = await listArtistUnitSources(input.artistId);
    const stale = entries.filter(
      e => e.sourceRevision !== null && e.indexedRevision !== e.sourceRevision,
    );
    let ingested = 0;
    let failed = 0;
    let unitsWritten = 0;
    for (const e of stale) {
      if (budget.snapshot().blocked) {
        failed += 1;
        continue;
      }
      try {
        const outcome = await ingestSource(
          { sourceKind: e.sourceKind, sourceId: e.sourceId },
          { ocr: true, pdfTimeoutMs: 45_000, signal: AbortSignal.timeout(50_000) },
        );
        if (outcome.failed) failed += 1;
        else ingested += 1;
        unitsWritten += outcome.units;
      } catch {
        failed += 1;
      }
    }
    const result = { sources: entries.length, ingested, failed, unitsWritten };
    console.log(`[units-backfill] ${JSON.stringify(result)}`);
    return result;
  },
  scores: [
    ({ output }) => ({
      name: "indexed",
      score: output.unitsWritten > 0 || output.sources === 0 ? 1 : 0,
    }),
  ],
});
