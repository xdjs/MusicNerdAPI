import type { CaptionCredit, CaptionExtraction } from "@/lib/credits/types";

/**
 * What the artist says they do themselves ("Recording Engineer: Pharaoh
 * Sistare"): worth knowing, and not a collaboration. Deduped by role, since an
 * artist signing off "Producer" on thirty posts has told us one thing.
 *
 * @param extraction - The stored credits and statements.
 * @returns One self-credit per role.
 */
export function selfCredits(extraction: CaptionExtraction): CaptionCredit[] {
  const seen = new Set<string>();
  return extraction.credits.filter(c => {
    if (!c.isSelf) return false;
    const key = c.role.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
