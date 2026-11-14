import { createEvalBudgetFetch } from "@/lib/evals/createEvalBudgetFetch";
import { Eval } from "braintrust";
import { MODEL_EMBEDDING } from "@/lib/ai/const";
import { RETRIEVAL_CASES, type RetrievalFact } from "@/lib/evals/retrievalCases";
import { toRetrievalFailure } from "@/lib/evals/toRetrievalFailure";
import { retrievalReporter } from "@/lib/evals/retrievalReporter";
import { experimentName } from "@/lib/evals/experimentName";
import { formatSearchSignals } from "@/lib/evals/formatSearchSignals";
import { scoreRetrievalFacts, type FactResult } from "@/lib/evals/scoreRetrievalFacts";
import { getSearchTuning } from "@/lib/units/getSearchTuning";
import { searchUnits } from "@/lib/units/searchUnits";
import type { UnitSourceKind } from "@/lib/units/types";

/**
 * Retrieval suite: for each chat question, does the page-level text index return a unit for each
 * labelled fact in its top eight? A fact is found when any one of its units is retrieved
 * (`lib/evals/retrievalLabels.ts`). Calls `searchUnits` directly against the staging database; no model
 * reads the results. Pass or fail by `lib/evals/retrievalGates.ts`, applied by the reporter.
 * Run `units-backfill` first on a database whose index is empty.
 *
 * Unit text is never logged or returned: output is source ids, locators, titles, public URLs
 * and scores. With `RETRIEVAL_LABEL=1` (workflow input `label`) each hit is also printed to
 * stderr as one line, so the labeller can open the public document and write the facts into
 * `lib/evals/retrievalLabels.ts`, followed by one `signals` line per case (text matched, best
 * vector score, weak) so the `weak` flag can be checked.
 *
 * Ranking variants are compared without code edits through `UNITS_MAX_PER_DOCUMENT`,
 * `UNITS_TEXT_MODE` and `UNITS_CANDIDATES` (workflow inputs `units_*`, see
 * `lib/units/getSearchTuning.ts`); the effective tuning is logged and kept in the metadata.
 *
 *   pnpm eval evals/retrieval.eval.ts          # hosted: records to Braintrust
 *   pnpm eval:local evals/retrieval.eval.ts    # from .env.local, nothing sent to Braintrust
 */

const budget = createEvalBudgetFetch(globalThis.fetch);
globalThis.fetch = budget.fetch;

const SHA = process.env.GITHUB_SHA ?? "local";
const LABEL = process.env.RETRIEVAL_LABEL === "1";
const TUNING = getSearchTuning();
console.log(
  `[retrieval] tuning: maxUnitsPerDocument=${TUNING.maxUnitsPerDocument} textMode=${TUNING.textMode} candidates=${TUNING.candidates}`,
);

type Row = {
  key: string;
  artistId: string;
  artistName: string;
  question: string;
  answerable: boolean;
  facts: RetrievalFact[];
};

const row = (
  key: string,
  c: { artistId: string; artistName: string },
  question: string,
  answerable: boolean,
  facts: RetrievalFact[],
  note: string,
) => ({
  input: { key, artistId: c.artistId, artistName: c.artistName, question, answerable, facts },
  expected: { facts, answerable },
  metadata: { key, artist: c.artistName, note, labelled: facts.length > 0 },
});

const rows = RETRIEVAL_CASES.flatMap(c => [
  row(c.key, c, c.question, c.answerable, c.facts, c.note),
  ...(c.followUp
    ? [row(`${c.key}/follow-up`, c, c.followUp.question, true, c.followUp.facts, c.followUp.note)]
    : []),
]);

type Output = {
  hits: {
    sourceKind: UnitSourceKind;
    sourceId: string;
    locator: string;
    title: string | null;
    url: string | null;
    score: number;
  }[];
  weak: boolean;
  /** Each labelled fact: found, and the 1-based rank of its first unit. Our labels, not document text. */
  facts: FactResult[];
  error?: string;
};

const failed = (input: Row, error: string): Output => ({
  hits: [],
  weak: false,
  facts: scoreRetrievalFacts({ hits: [], weak: false }, input).facts,
  error,
});

Eval(
  "music-nerd",
  {
    experimentName: experimentName("retrieval", MODEL_EMBEDDING, SHA),
    metadata: { suite: "retrieval", embeddingModel: MODEL_EMBEDDING, sha: SHA, tuning: TUNING },
    maxConcurrency: 1,
    data: () => rows,
    task: async (input: Row): Promise<Output> => {
      if (budget.snapshot().blocked)
        return failed(input, `Not attempted: ${budget.snapshot().stopReason}`);
      try {
        const { hits, weak, signals } = await searchUnits(input.artistId, input.question, {
          names: [input.artistName],
        });
        if (LABEL) {
          hits.forEach((h, i) =>
            console.error(
              `label ${input.key} #${i + 1} ${h.sourceKind} ${h.sourceId} ${h.locator} ${h.title ?? "-"} ${h.url ?? "-"}`,
            ),
          );
          console.error(formatSearchSignals(input.key, { weak, signals }));
        }
        console.log(`[retrieval] ${input.key} hits=${hits.length} weak=${weak}`);
        const units = hits.map(h => ({
          sourceKind: h.sourceKind,
          sourceId: h.sourceId,
          locator: h.locator,
          title: h.title,
          url: h.url,
          score: h.score,
        }));
        return {
          hits: units,
          weak,
          facts: scoreRetrievalFacts({ hits: units, weak }, input).facts,
        };
      } catch (error) {
        const row = toRetrievalFailure(input, error);
        console.error(`[retrieval] ${input.key}: ${row.error}`);
        return row;
      }
    },
    scores: [
      // Share of the labelled facts found in the hits; an unanswerable case with no facts is right
      // when the search reports itself weak.
      ({ output, expected }) => ({
        name: "recall_at_8",
        score: scoreRetrievalFacts(output, expected).recall,
      }),
      // 1 over the 1-based rank of the first hit that satisfies any fact; 0 when none does.
      ({ output, expected }) => ({
        name: "reciprocal_rank",
        score: scoreRetrievalFacts(output, expected).reciprocalRank,
      }),
    ],
  },
  { reporter: retrievalReporter },
);
