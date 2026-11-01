import { createEvalBudgetFetch } from "@/lib/evals/createEvalBudgetFetch";
import { Eval } from "braintrust";
import { MODEL_CHAT } from "@/lib/ai/const";
import { FIRST_TEXT_BUDGET_MS, TOTAL_BUDGET_MS } from "@/lib/evals/chatBudgets";
import { CHAT_CASES, type ChatCase } from "@/lib/evals/chatCases";
import { experimentName } from "@/lib/evals/experimentName";
import { judgeCitedAnswer } from "@/lib/evals/judgeCitedAnswer";
import { chatStreamTurn } from "@/lib/evals/chatStreamTurn";
import { scoreCitations } from "@/lib/evals/scorers/scoreCitations";
import { scoreWithinBudget } from "@/lib/evals/scorers/scoreWithinBudget";

/**
 * Chat suite (xdjs/MusicNerdWeb#1629): how fast an artist-page question gets text, how long
 * the whole answer takes, whether its citations resolve, and whether it answers the question
 * from the facts. Questions are hand-checked against staging fixtures' stored sources.
 *
 * Calls the streaming chat endpoint in process. Runs against the staging database; reads
 * only, apart from the allowance rows a real question writes.
 *
 *   pnpm eval evals/chat.eval.ts
 */

// Explicit opt-in only. The ordinary multi-case suite below stays unchanged.
if (process.env.CHAT_SINGLE_MANIFEST) {
  const { runSingleGuardedChatTurn } = await import("@/lib/evals/runSingleGuardedChatTurn");
  Eval("music-nerd", {
    experimentName: experimentName("chat-single", MODEL_CHAT, process.env.GITHUB_SHA ?? "local"),
    isPublic: false,
    maxConcurrency: 1,
    data: () => [{ input: process.env.CHAT_SINGLE_MANIFEST! }],
    task: async path => runSingleGuardedChatTurn(path),
    scores: [],
  });
} else {
  // Carry attempt 1 forward under Pete's original $5 ceiling (run 40975550504).
  const budget = createEvalBudgetFetch(globalThis.fetch, 104224);
  globalThis.fetch = budget.fetch;

  const SHA = process.env.GITHUB_SHA ?? "local";

  Eval("music-nerd", {
    experimentName: experimentName("chat", MODEL_CHAT, SHA),
    metadata: {
      suite: "chat",
      model: MODEL_CHAT,
      sha: SHA,
      rubric: "cited-evidence-v1",
      budgetUsd: 5,
      priorReservedUsd: 0.104224,
      maxOutputTokens: 2048,
    },
    // One question at a time, so the timings are not measuring each other.
    maxConcurrency: 1,
    data: () =>
      CHAT_CASES.map(c => ({
        input: c,
        expected: { answerable: c.answerable, reference: c.reference },
        metadata: { key: c.key, artist: c.artistName, note: c.note },
      })),
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
      const turn = await chatStreamTurn(input);
      console.log(
        `[chat] ${input.key} first=${turn.firstTextMs}ms total=${turn.totalMs}ms sources=${turn.sources.length}${turn.error ? ` error=${turn.error}` : ""}`,
      );
      return turn;
    },
    scores: [
      ({ output }) =>
        output.error
          ? null
          : scoreWithinBudget("first_text", output.firstTextMs, FIRST_TEXT_BUDGET_MS),
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
  });
}
