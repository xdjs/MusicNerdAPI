import { readFileSync } from "node:fs";
import path from "node:path";
import { describeEvalError } from "@/lib/evals/describeEvalError";
import { Eval } from "braintrust";
import { MODEL_OCR } from "@/lib/ai/const";
import { createEvalBudgetFetch } from "@/lib/evals/createEvalBudgetFetch";
import { experimentName } from "@/lib/evals/experimentName";
import { readPageWithVision } from "@/lib/units/readPageWithVision";

/**
 * Proof that the vision pass reads a scanned page (no text layer) before the chat's PDF
 * path relies on it. One case: the committed image-only fixture holds one neutral
 * sentence; the score is whether the transcription contains it. The transcription is not
 * printed: only the score is recorded.
 *
 * Hosted: the Evals workflow, suite `vision-page`. Local: `pnpm eval:local evals/vision-page.eval.ts`.
 */

const budget = createEvalBudgetFetch(globalThis.fetch);
globalThis.fetch = budget.fetch;

const SHA = process.env.GITHUB_SHA ?? "local";
const PHRASE = "Music Nerd vision fixture, November 2026";
/** Resolved from the repo root: the eval CLI bundles to CommonJS, where import.meta.url is empty. */
const FIXTURE = path.join(process.cwd(), "lib/units/__tests__/fixtures/scanned-page.pdf");

Eval("music-nerd", {
  experimentName: experimentName("vision-page", MODEL_OCR, SHA),
  metadata: { suite: "vision-page", model: MODEL_OCR, sha: SHA },
  maxConcurrency: 1,
  data: () => [{ input: { fixture: "scanned-page.pdf" }, expected: { phrase: PHRASE } }],
  task: async () => {
    if (budget.snapshot().blocked)
      return { transcription: "", error: `Not attempted: ${budget.snapshot().stopReason}` };
    try {
      const bytes = new Uint8Array(readFileSync(FIXTURE));
      return { transcription: await readPageWithVision(bytes), error: undefined };
    } catch (error) {
      const message = describeEvalError(error);
      // The allowlisted diagnostic only: not the message, the response body or the transcription.
      console.error(`vision-page: ${message}`);
      return { transcription: "", error: message };
    }
  },
  scores: [
    ({ output, expected }) => ({
      name: "contains_phrase",
      score: output.transcription.toLowerCase().includes(expected.phrase.toLowerCase()) ? 1 : 0,
    }),
  ],
});
