import { Eval } from "braintrust";
import { MODEL_CHAT } from "@/lib/ai/const";
import { FIRST_TEXT_BUDGET_MS, TOTAL_BUDGET_MS } from "@/lib/evals/chatBudgets";
import { CHAT_CASES, type ChatCase } from "@/lib/evals/chatCases";
import { experimentName } from "@/lib/evals/experimentName";
import { judgeAnswer } from "@/lib/evals/judgeAnswer";
import { runChatTurn } from "@/lib/evals/runChatTurn";
import { scoreAnswerQuality } from "@/lib/evals/scorers/scoreAnswerQuality";
import { scoreCitations } from "@/lib/evals/scorers/scoreCitations";
import { scoreWithinBudget } from "@/lib/evals/scorers/scoreWithinBudget";

/**
 * Chat suite (xdjs/MusicNerdWeb#1629): how fast an artist-page question gets text, how long
 * the whole answer takes, whether its citations resolve, and whether it answers the question
 * from the facts. Questions are hand-checked against staging fixtures' stored sources.
 *
 * `CHAT_EVAL_TARGET` picks the code under test: `askArtist` (today's job relay, the
 * baseline) by default, or `chat` (the streaming chat endpoint). Runs against the staging database; reads only, apart from the
 * research jobs and allowance rows a real question writes.
 *
 *   pnpm eval evals/chat.eval.ts
 */

const SHA = process.env.GITHUB_SHA ?? "local";
const TARGET = process.env.CHAT_EVAL_TARGET || "askArtist";

Eval("music-nerd", {
  experimentName: experimentName("chat", MODEL_CHAT, SHA),
  metadata: { suite: "chat", model: MODEL_CHAT, sha: SHA, target: TARGET },
  // One question at a time, so the timings are not measuring each other.
  maxConcurrency: 1,
  data: () =>
    CHAT_CASES.map(c => ({
      input: c,
      expected: { answerable: c.answerable, reference: c.reference },
      metadata: { key: c.key, artist: c.artistName, note: c.note },
    })),
  task: async (input: ChatCase) => {
    const turn = await runChatTurn(TARGET, input);
    console.log(
      `[chat] ${input.key} first=${turn.firstTextMs}ms total=${turn.totalMs}ms sources=${turn.sources.length}${turn.error ? ` error=${turn.error}` : ""}`,
    );
    return turn;
  },
  scores: [
    ({ output }) => scoreWithinBudget("first_text", output.firstTextMs, FIRST_TEXT_BUDGET_MS),
    ({ output }) => scoreWithinBudget("total_time", output.totalMs, TOTAL_BUDGET_MS),
    // An unanswerable question is right to cite nothing, so citations are not scored there.
    ({ output, expected }) =>
      expected.answerable
        ? scoreCitations(
            output.answer,
            output.sources.map(s => s.n),
          )
        : null,
    async ({ input, output, expected }) =>
      scoreAnswerQuality(
        await judgeAnswer({
          question: input.question,
          reference: expected.reference,
          answerable: expected.answerable,
          answer: output.answer,
        }),
      ),
  ],
});
