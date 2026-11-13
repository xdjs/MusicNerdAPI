import { createEvalBudgetFetch } from "@/lib/evals/createEvalBudgetFetch";
import { Eval } from "braintrust";
import { MODEL_CHAT } from "@/lib/ai/const";
import { CHAT_CASES } from "@/lib/evals/chatCases";
import { chatStreamTurn } from "@/lib/evals/chatStreamTurn";
import { experimentName } from "@/lib/evals/experimentName";
import { judgeCitedAnswer } from "@/lib/evals/judgeCitedAnswer";
import { scoreCitations } from "@/lib/evals/scorers/scoreCitations";
import { withAllowanceWait } from "@/lib/evals/withAllowanceWait";

/**
 * Experiment suite (xdjs/MusicNerdWeb#1424, 2026-11-12): asks the acceptance question
 * `trials` times and records whether every alias from the Dutchyyy timeline PDF appears,
 * so two PDF read variants can be compared. The variant is the handler's own switch,
 * `CHAT_PDF_TEXT_ALONGSIDE=1`, which hands the model the PDF's extracted text with page
 * markers beside the original bytes. Each answer is also graded by several candidate judge
 * models, `CHAT_JUDGES` (comma-separated gateway ids), to choose `MODEL_JUDGE` on evidence.
 *
 * Hosted: the Evals workflow, suite `chat-pdf-text`, with the `pdf_text_alongside` and
 * `trials` inputs. Local: `pnpm eval:local evals/chat-pdf-text.eval.ts`.
 */

const budget = createEvalBudgetFetch(globalThis.fetch);
globalThis.fetch = budget.fetch;

const SHA = process.env.GITHUB_SHA ?? "local";
const CASE = CHAT_CASES.find(c => c.key === "dutchyyy-alias-years")!;
const TRIALS = Math.min(10, Math.max(1, Number(process.env.CHAT_TRIALS) || 5));
const VARIANT = process.env.CHAT_PDF_TEXT_ALONGSIDE === "1" ? "text-alongside" : "bytes-only";
const JUDGES = (
  process.env.CHAT_JUDGES ?? "google/gemini-3.8-flash,google/gemini-4-hydrogen,openai/gpt-5.4"
)
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);
/** The aliases the reference requires; "Chill Factor" is the one-off 2001 credit on page 2. */
const ALIASES = ["Dutchmassive", "Dutchy", "Dutchyyy", "Chill Factor"];
/** Whole-word, case-insensitive: "Dutchy" must not match inside "Dutchyyy". */
const mentions = (answer: string, alias: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])${alias.replace(/ /g, "\\s+")}(?![\\p{L}\\p{N}])`, "iu").test(
    answer,
  );

Eval("music-nerd", {
  experimentName: experimentName(`chat-pdf-text ${VARIANT}`, MODEL_CHAT, SHA),
  metadata: {
    suite: "chat-pdf-text",
    model: MODEL_CHAT,
    sha: SHA,
    variant: VARIANT,
    trials: TRIALS,
    judges: JUDGES,
    rubric: "cited-evidence-v2",
  },
  maxConcurrency: 1,
  data: () =>
    Array.from({ length: TRIALS }, (_, i) => ({
      input: CASE,
      expected: { answerable: CASE.answerable, reference: CASE.reference },
      metadata: { key: CASE.key, trial: i + 1, variant: VARIANT },
    })),
  task: async input => {
    if (budget.snapshot().blocked)
      return {
        answer: "",
        sources: [],
        evidence: [],
        firstTextMs: 0,
        totalMs: 0,
        error: `Not attempted: ${budget.snapshot().stopReason}`,
        present: [] as string[],
        missing: ALIASES,
      };
    const turn = await withAllowanceWait(() => chatStreamTurn(input));
    const present = ALIASES.filter(a => mentions(turn.answer, a));
    const missing = ALIASES.filter(a => !present.includes(a));
    console.log(
      `\n[${VARIANT}] first=${turn.firstTextMs}ms total=${turn.totalMs}ms tools=${(turn.tools ?? []).map(t => t.name).join(">")} missing=${JSON.stringify(missing)}${turn.error ? ` error=${turn.error}` : ""}\n${turn.answer}\n`,
    );
    return { ...turn, present, missing };
  },
  scores: [
    ({ output }) => ({ name: "all_aliases", score: output.missing.length === 0 ? 1 : 0 }),
    ({ output }) => ({
      name: "chill_factor",
      score: output.present.includes("Chill Factor") ? 1 : 0,
    }),
    ({ output }) => ({ name: "total_under_20s", score: output.totalMs <= 20_000 ? 1 : 0 }),
    ({ output }) =>
      output.error
        ? null
        : scoreCitations(
            output.answer,
            output.sources.map(s => s.n),
          ),
    async ({ input, output, expected }) => {
      const scores: { name: string; score: number | null; metadata?: { reason?: string } }[] = [];
      for (const model of JUDGES) {
        const started = Date.now();
        const result = await judgeCitedAnswer({
          question: input.question,
          reference: expected.reference,
          answerable: expected.answerable,
          turn: output,
          model,
        });
        const short = model.split("/")[1].replace(/[^a-z0-9]/gi, "_");
        console.log(
          `[judge ${model}] ${Date.now() - started}ms ${JSON.stringify(result.verdict ?? result.unscoredReason)}`,
        );
        const metadata = { reason: result.verdict?.reason ?? result.unscoredReason };
        scores.push(
          { name: `relevance_${short}`, score: result.verdict?.relevance ?? null, metadata },
          { name: `groundedness_${short}`, score: result.verdict?.groundedness ?? null, metadata },
        );
      }
      return scores;
    },
  ],
});
