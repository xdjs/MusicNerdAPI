import { createEvalBudgetFetch } from "@/lib/evals/createEvalBudgetFetch";
import { Eval } from "braintrust";
import { MODEL_EMBEDDING } from "@/lib/ai/const";
import { RETRIEVAL_CASES } from "@/lib/evals/retrievalCases";
import { experimentName } from "@/lib/evals/experimentName";
import { runUnitsBackfill } from "@/lib/evals/runUnitsBackfill";

/**
 * One-time backfill of the page-level text index for the retrieval suite's artists, on the
 * staging database, once Web migration 0066 is applied there and before the `retrieval` suite.
 * Ingests, with OCR, every source whose indexed revision is not its current one or whose units
 * lack embeddings (`runUnitsBackfill`), and scores `indexed` 1 when nothing is left stale. Output is
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
    const result = await runUnitsBackfill(input.artistId, {
      blocked: () => budget.snapshot().blocked,
    });
    console.log(`[units-backfill] ${JSON.stringify(result)}`);
    return result;
  },
  scores: [
    ({ output }) => ({
      name: "indexed",
      // A clean rerun scores 1: nothing is left stale or without vectors.
      score: output.stale === 0 ? 1 : 0,
    }),
  ],
});
