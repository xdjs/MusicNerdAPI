import { z } from "zod";
import { generateArray } from "@/lib/ai/generateArray";
import { withTimeout } from "@/lib/async/withTimeout";
import { VERIFIER_INSTRUCTION, VERIFIER_TIMEOUT_MS } from "@/lib/questions/const";
import type { DraftedQuestion, GroundedQuestion } from "@/lib/questions/types";

/**
 * Drops any question that says something its source doesn't. The model once
 * compressed "he handed me two albums, and those shifted me" into "he
 * introduced you to samplers", crediting a real person with something never
 * said. Fails closed: if the checker can't run, nothing grounded goes out. A
 * question with no verdict is unverified, not approved. Recent and Lore
 * questions must also engage with the content.
 *
 * @param drafted - The drafts, each with the material it may assert.
 * @param artistName - The artist.
 * @returns The approved questions, in draft order.
 */
export async function keepOnlySupported(
  drafted: DraftedQuestion[],
  artistName: string,
): Promise<GroundedQuestion[]> {
  if (drafted.length === 0) return [];
  const payload = drafted
    .map(
      (d, i) =>
        `--- QUESTION ${i} ---\nKIND: ${d.kind}\nQ: ${d.question}\nSOURCE:\n${d.materials.join("\n---\n")}`,
    )
    .join("\n\n");

  let verdicts: { i?: unknown; ok?: unknown; contentSpecific?: unknown; problem?: unknown }[];
  try {
    const res = await withTimeout(
      generateArray({
        prompt: `The artist is "${artistName}".\n\n${payload}`,
        instructions: VERIFIER_INSTRUCTION,
        temperature: 0,
        element: z.object({
          i: z.number().optional(),
          ok: z.boolean().optional(),
          contentSpecific: z.boolean().optional(),
          problem: z.string().optional(),
        }),
        // A judgement task: with thinking off it rejected supported questions.
        thinkingBudget: 512,
      }),
      VERIFIER_TIMEOUT_MS,
      "verifier timeout",
    );
    verdicts = res.output;
  } catch (e) {
    console.error("[questionGenerator] verifier unavailable, dropping every grounded question:", e);
    return [];
  }

  const approved = new Map<number, boolean>();
  for (const v of verdicts) {
    if (typeof v?.i !== "number" || !Number.isInteger(v.i)) continue;
    const needsContent = drafted[v.i]?.kind === "recent" || drafted[v.i]?.kind === "lore";
    approved.set(v.i, v.ok === true && (!needsContent || v.contentSpecific === true));
    if (v.ok !== true) {
      console.log(`[questionGenerator] dropped a question: ${String(v.problem ?? "unsupported")}`);
    }
  }
  return drafted
    .filter((_, i) => approved.get(i) === true)
    .map(d => ({
      key: d.key,
      question: d.question,
      rationale: d.rationale,
      sourceUrls: d.sourceUrls,
      kind: d.kind,
    }));
}
