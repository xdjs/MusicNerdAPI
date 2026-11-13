import { createEvalBudgetFetch } from "@/lib/evals/createEvalBudgetFetch";
import { Eval } from "braintrust";
import { MODEL_CHAT, MODEL_JUDGE } from "@/lib/ai/const";
import { FIRST_TEXT_BUDGET_MS, TOTAL_BUDGET_MS } from "@/lib/evals/chatBudgets";
import { CHAT_CASES, type ChatCase } from "@/lib/evals/chatCases";
import { chatReporter } from "@/lib/evals/chatReporter";
import { experimentName } from "@/lib/evals/experimentName";
import { judgeCitedAnswer } from "@/lib/evals/judgeCitedAnswer";
import { chatStreamTurn } from "@/lib/evals/chatStreamTurn";
import { scoreCitations } from "@/lib/evals/scorers/scoreCitations";
import { scoreWithinBudget } from "@/lib/evals/scorers/scoreWithinBudget";
import { withAllowanceWait } from "@/lib/evals/withAllowanceWait";

/**
 * Chat suite (xdjs/MusicNerdWeb#1629): how fast an artist-page question gets text, how long
 * the whole answer takes, whether its citations resolve, and whether it answers the question
 * from the facts. Questions are hand-checked against staging fixtures' stored sources.
 *
 * Calls the streaming chat endpoint in process. Runs against the staging database; reads
 * only, apart from the allowance rows a real question writes. A case with `trials` is asked
 * that many times. The run passes or fails by `lib/evals/chatGates.ts`, applied by the
 * reporter; first text is reported, not gated.
 *
 *   pnpm eval evals/chat.eval.ts          # hosted: records to Braintrust
 *   pnpm eval:local evals/chat.eval.ts    # from .env.local, nothing sent to Braintrust
 */

// Carry attempt 1 forward; the ceiling is ten dollars of conservative reservations (see
// createEvalBudgetFetch), which the 14-question suite with PDF reads needs. Actual spend is about a dollar.
const budget = createEvalBudgetFetch(globalThis.fetch, 104224);
globalThis.fetch = budget.fetch;

const SHA = process.env.GITHUB_SHA ?? "local";

Eval(
  "music-nerd",
  {
    experimentName: experimentName("chat", MODEL_CHAT, SHA),
    metadata: {
      suite: "chat",
      model: MODEL_CHAT,
      sha: SHA,
      rubric: "cited-evidence-v2",
      judgeModel: MODEL_JUDGE,
      budgetUsd: 10,
      priorReservedUsd: 0.104224,
      maxOutputTokens: 2048,
    },
    // One question at a time, so the timings are not measuring each other.
    maxConcurrency: 1,
    data: () =>
      CHAT_CASES.flatMap(c =>
        Array.from({ length: c.trials ?? 1 }, (_, i) => ({
          input: c,
          expected: { answerable: c.answerable, reference: c.reference },
          metadata: {
            key: c.key,
            artist: c.artistName,
            note: c.note,
            ...(c.trials ? { trial: i + 1, trials: c.trials } : {}),
          },
        })),
      ),
    task: async (input: ChatCase) => {
      // A latched guard must not consume further question-admission rows or SDK retries.
      if (budget.snapshot().blocked)
        return {
          answer: "",
          sources: [],
          evidence: [],
          firstTextMs: 0,
          totalMs: 0,
          error: `Not attempted: ${budget.snapshot().stopReason}`,
        };
      const turn = await withAllowanceWait(() => chatStreamTurn(input));
      console.log(
        `[chat] ${input.key} first=${turn.firstTextMs}ms total=${turn.totalMs}ms sources=${turn.sources.length}${turn.error ? ` error=${turn.error}` : ""}`,
      );
      // A citation with no returned source is the one defect the log cannot otherwise show
      // (answers are not printed: the repository is public). Numbers only.
      const citations = scoreCitations(
        turn.answer,
        turn.sources.map(s => s.n),
      );
      if (citations.score < 1)
        console.log(
          `[chat] ${input.key} dangling citations: cited=${JSON.stringify(citations.metadata.cited)} sources=${JSON.stringify(turn.sources.map(s => s.n))}`,
        );
      return turn;
    },
    scores: [
      ({ output }) =>
        output.error
          ? null
          : scoreWithinBudget("first_text", output.firstTextMs, FIRST_TEXT_BUDGET_MS),
      // What the artist page shows first is a progress line from the first tool step; this is
      // the time to that, reported beside first_text and not gated either.
      ({ output }) =>
        output.error
          ? null
          : scoreWithinBudget(
              "first_signal",
              output.firstSignalMs ?? output.firstTextMs,
              FIRST_TEXT_BUDGET_MS,
            ),
      ({ output }) =>
        output.error ? null : scoreWithinBudget("total_time", output.totalMs, TOTAL_BUDGET_MS),
      // An unanswerable question is right to cite nothing, so citations are not scored there.
      ({ output, expected }) =>
        expected.answerable
          ? scoreCitations(
              output.answer,
              output.sources.map(s => s.n),
            )
          : null,
      async ({ input, output, expected }) => {
        const result = await judgeCitedAnswer({
          question: input.question,
          reference: expected.reference,
          answerable: expected.answerable,
          turn: output,
        });
        const metadata = { reason: result.verdict?.reason ?? result.unscoredReason };
        return [
          { name: "evidence_scorable", score: result.verdict ? 1 : 0, metadata },
          { name: "answer_relevance", score: result.verdict?.relevance ?? null, metadata },
          { name: "source_groundedness", score: result.verdict?.groundedness ?? null, metadata },
        ];
      },
    ],
  },
  { reporter: chatReporter },
);
