import { createEvalBudgetFetch } from "@/lib/evals/createEvalBudgetFetch";
import { Eval } from "braintrust";
import { MODEL_EMBEDDING } from "@/lib/ai/const";
import { RETRIEVAL_CASES, type ExpectedUnit } from "@/lib/evals/retrievalCases";
import { describeEvalError } from "@/lib/evals/describeEvalError";
import { retrievalReporter } from "@/lib/evals/retrievalReporter";
import { experimentName } from "@/lib/evals/experimentName";
import { searchUnits } from "@/lib/units/searchUnits";

/**
 * Retrieval suite: for each chat question, does the page-level text index return the labelled
 * units in its top eight? Calls `searchUnits` directly against the staging database; no model
 * reads the results. Pass or fail by `lib/evals/retrievalGates.ts`, applied by the reporter.
 * Run `units-backfill` first on a database whose index is empty.
 *
 * Unit text is never logged or returned: output is source ids, locators, titles, public URLs
 * and scores. With `RETRIEVAL_LABEL=1` (workflow input `label`) each hit is also printed to
 * stderr as one line, so the labeller can open the public document and write the expected
 * pairs into `lib/evals/retrievalCases.ts`.
 *
 *   pnpm eval evals/retrieval.eval.ts          # hosted: records to Braintrust
 *   pnpm eval:local evals/retrieval.eval.ts    # from .env.local, nothing sent to Braintrust
 */

const budget = createEvalBudgetFetch(globalThis.fetch);
globalThis.fetch = budget.fetch;

const SHA = process.env.GITHUB_SHA ?? "local";
const LABEL = process.env.RETRIEVAL_LABEL === "1";

type Row = { key: string; artistId: string; artistName: string; question: string };

const rows = RETRIEVAL_CASES.flatMap(c => [
  {
    input: { key: c.key, artistId: c.artistId, artistName: c.artistName, question: c.question },
    expected: { units: c.expected, answerable: c.answerable },
    metadata: { key: c.key, artist: c.artistName, note: c.note, labelled: c.expected.length > 0 },
  },
  ...(c.followUp
    ? [
        {
          input: {
            key: `${c.key}/follow-up`,
            artistId: c.artistId,
            artistName: c.artistName,
            question: c.followUp.question,
          },
          expected: { units: c.followUp.expected, answerable: true },
          metadata: {
            key: `${c.key}/follow-up`,
            artist: c.artistName,
            note: c.followUp.note,
            labelled: c.followUp.expected.length > 0,
          },
        },
      ]
    : []),
]);

type Output = {
  hits: {
    sourceKind: string;
    sourceId: string;
    locator: string;
    title: string | null;
    url: string | null;
    score: number;
  }[];
  weak: boolean;
  error?: string;
};

const isExpected = (hit: Output["hits"][number], e: ExpectedUnit) =>
  hit.sourceId === e.sourceId && hit.locator === e.locator;

Eval(
  "music-nerd",
  {
    experimentName: experimentName("retrieval", MODEL_EMBEDDING, SHA),
    metadata: { suite: "retrieval", embeddingModel: MODEL_EMBEDDING, sha: SHA },
    maxConcurrency: 1,
    data: () => rows,
    task: async (input: Row): Promise<Output> => {
      if (budget.snapshot().blocked)
        return { hits: [], weak: false, error: `Not attempted: ${budget.snapshot().stopReason}` };
      try {
        const { hits, weak } = await searchUnits(input.artistId, input.question, {
          names: [input.artistName],
        });
        if (LABEL)
          hits.forEach((h, i) =>
            console.error(
              `label ${input.key} #${i + 1} ${h.sourceKind} ${h.sourceId} ${h.locator} ${h.title ?? "-"} ${h.url ?? "-"}`,
            ),
          );
        console.log(`[retrieval] ${input.key} hits=${hits.length} weak=${weak}`);
        return {
          hits: hits.map(h => ({
            sourceKind: h.sourceKind,
            sourceId: h.sourceId,
            locator: h.locator,
            title: h.title,
            url: h.url,
            score: h.score,
          })),
          weak,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[retrieval] ${input.key}: ${describeEvalError(error)}`);
        return { hits: [], weak: false, error: message };
      }
    },
    scores: [
      // Share of the expected pairs found in the hits; an unanswerable case with no labels is
      // right when the search reports itself weak.
      ({ output, expected }) => {
        if (expected.units.length === 0)
          return {
            name: "recall_at_8",
            score: !expected.answerable && output.weak ? 1 : 0,
          };
        const found = expected.units.filter((e: ExpectedUnit) =>
          output.hits.some(h => isExpected(h, e)),
        ).length;
        return { name: "recall_at_8", score: found / expected.units.length };
      },
      // 1 over the 1-based rank of the first expected hit; 0 when none is returned.
      ({ output, expected }) => {
        const rank = output.hits.findIndex(h =>
          expected.units.some((e: ExpectedUnit) => isExpected(h, e)),
        );
        return { name: "reciprocal_rank", score: rank === -1 ? 0 : 1 / (rank + 1) };
      },
    ],
  },
  { reporter: retrievalReporter },
);
