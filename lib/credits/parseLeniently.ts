import type { RawCredit, RawStatement } from "@/lib/credits/types";

/**
 * Reads a reply the schema rejected. The gate is `verifyClaims`, which checks
 * every field itself, so one mistyped item must not cost the batch its valid
 * siblings.
 *
 * @param text - The model's raw reply.
 * @returns The raw credits and statements; empty (and logged) when it is not JSON.
 */
export function parseLeniently(text: string): { credits: RawCredit[]; statements: RawStatement[] } {
  try {
    // Models occasionally wrap JSON in a fence.
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    const obj = JSON.parse(cleaned) as Record<string, unknown>;
    return {
      credits: Array.isArray(obj.credits) ? (obj.credits as RawCredit[]) : [],
      statements: Array.isArray(obj.statements) ? (obj.statements as RawStatement[]) : [],
    };
  } catch (e) {
    // Truncated JSON at the token ceiling used to lose a batch without a word.
    console.error(
      `[socialCredits] Could not parse a batch response (${text.length} chars, ends "${text.slice(-60).replace(/\s+/g, " ")}"):`,
      e,
    );
    return { credits: [], statements: [] };
  }
}
