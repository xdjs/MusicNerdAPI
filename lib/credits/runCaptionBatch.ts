import { z } from "zod";
import { generateObject } from "@/lib/ai/generateObject";
import { withTimeout } from "@/lib/async/withTimeout";
import { captionSystemInstruction } from "@/lib/credits/captionSystemInstruction";
import { TIMEOUT_MS } from "@/lib/credits/const";
import { isUnusableOutput } from "@/lib/credits/isUnusableOutput";
import { parseLeniently } from "@/lib/credits/parseLeniently";
import type { CaptionExtraction } from "@/lib/credits/types";
import { verifyClaims } from "@/lib/credits/verifyClaims";
import type { SocialPostRow } from "@/lib/instagram/types";

const replySchema = z.object({
  credits: z
    .array(
      z.object({
        subject: z.string().optional(),
        isHandle: z.boolean().optional(),
        role: z.string().optional(),
        quote: z.string().optional(),
        url: z.string().optional(),
      }),
    )
    .optional(),
  statements: z
    .array(
      z.object({
        quote: z.string().optional(),
        topic: z.string().optional(),
        url: z.string().optional(),
      }),
    )
    .optional(),
});

/**
 * One model call over one batch of captions, verified. Never throws: a batch
 * that fails costs its own captions and nothing else.
 *
 * @param batch - The posts to read.
 * @param artistName - The artist's name.
 * @param artistHandle - The artist's handle.
 * @param index - The batch's label, for logs.
 * @param budgetMs - The call's time limit.
 * @returns The verified claims, or null when the batch could not be read (not the same as nothing found).
 */
export async function runCaptionBatch(
  batch: SocialPostRow[],
  artistName: string,
  artistHandle: string,
  index: string,
  budgetMs: number = TIMEOUT_MS,
): Promise<CaptionExtraction | null> {
  const payload = batch.map(p => ({ url: p.url, postedAt: p.postedAt, caption: p.caption }));
  try {
    const response = await withTimeout(
      generateObject({
        prompt: `CAPTIONS:\n${JSON.stringify(payload, null, 2)}`,
        instructions: captionSystemInstruction(artistName, artistHandle),
        // Copying text back verbatim is the job; creativity shows up as paraphrase.
        temperature: 0,
        schema: replySchema,
      }),
      budgetMs,
      "caption extraction timed out",
    );
    const { credits = [], statements = [] } = response.output;
    return verifyClaims({ credits, statements }, batch, artistName, artistHandle);
  } catch (e) {
    if (isUnusableOutput(e)) {
      const text = typeof e.text === "string" ? e.text : "";
      return verifyClaims(parseLeniently(text), batch, artistName, artistHandle);
    }
    // Cost is roughly proportional to how much the model writes, so half the
    // captions is well under half the time. The halves inherit what is LEFT,
    // not a fresh budget, or the retry outlives the invocation.
    if (batch.length > 2 && String(e).includes("timed out")) {
      const mid = Math.ceil(batch.length / 2);
      console.warn(
        `[socialCredits] Batch ${index} timed out for ${artistName}, retrying as two halves`,
      );
      const [a, b] = await Promise.all([
        runCaptionBatch(batch.slice(0, mid), artistName, artistHandle, `${index}a`, budgetMs),
        runCaptionBatch(batch.slice(mid), artistName, artistHandle, `${index}b`, budgetMs),
      ]);
      if (!a && !b) return null;
      return {
        credits: [...(a?.credits ?? []), ...(b?.credits ?? [])],
        statements: [...(a?.statements ?? []), ...(b?.statements ?? [])],
      };
    }
    console.error(`[socialCredits] Batch ${index} failed for ${artistName}:`, e);
    return null;
  }
}
