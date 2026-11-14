import { describeEvalError } from "@/lib/evals/describeEvalError";
import { scoreRetrievalFacts } from "@/lib/evals/scoreRetrievalFacts";
import type { RetrievalFact } from "@/lib/evals/retrievalLabels";

/**
 * The output row of a retrieval case whose search threw. Its `error` is the allowlisted
 * `describeEvalError` diagnostic, never the error's message: a drizzle error message holds the SQL and the bound parameters, and the row reaches the reporter, the gates and the public Actions log.
 *
 * @param input - The case's labelled facts and whether its sources can answer it.
 * @param error - The thrown value.
 * @returns No hits, not weak, every fact not found, and the diagnostic as `error`.
 */
export function toRetrievalFailure(
  input: { facts: RetrievalFact[]; answerable: boolean },
  error: unknown,
): {
  hits: [];
  weak: false;
  facts: ReturnType<typeof scoreRetrievalFacts>["facts"];
  error: string;
} {
  return {
    hits: [],
    weak: false,
    facts: scoreRetrievalFacts({ hits: [], weak: false }, input).facts,
    error: describeEvalError(error),
  };
}
