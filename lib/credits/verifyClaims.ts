import { MAX_CLAIMS_PER_BATCH } from "@/lib/credits/const";
import type { CaptionExtraction, RawCredit, RawStatement } from "@/lib/credits/types";
import { verifyCredit } from "@/lib/credits/verifyCredit";
import { verifyStatement } from "@/lib/credits/verifyStatement";
import type { SocialPostRow } from "@/lib/instagram/types";

/**
 * Checks one batch of model output against the posts it was given. This is
 * what stops the model inventing people: it may only report what was in front of it.
 *
 * @param raw - The model's credits and statements.
 * @param posts - The batch's posts.
 * @param artistName - The artist's name.
 * @param artistHandle - The artist's handle.
 * @returns Only the claims that passed.
 */
export function verifyClaims(
  raw: { credits: RawCredit[]; statements: RawStatement[] },
  posts: SocialPostRow[],
  artistName: string,
  artistHandle: string,
): CaptionExtraction {
  const byUrl = new Map(posts.map(p => [p.url, p]));
  return {
    credits: raw.credits
      .slice(0, MAX_CLAIMS_PER_BATCH)
      .map(c => verifyCredit(c, byUrl, artistName, artistHandle))
      .filter(c => c !== null),
    statements: raw.statements
      .slice(0, MAX_CLAIMS_PER_BATCH)
      .map(s => verifyStatement(s, byUrl))
      .filter(s => s !== null),
  };
}
