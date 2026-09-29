import type { CaptionExtraction } from "@/lib/credits/types";
import { foldName } from "@/lib/text/foldName";

/**
 * Drops exact repeats, in place. A sweep can legitimately re-find what a slice found.
 *
 * @param out - The extraction to dedupe.
 * @returns Nothing; `out` is changed.
 */
export function dedupeExtraction(out: CaptionExtraction): void {
  const seen = new Set<string>();
  out.credits = out.credits.filter(c => {
    const k = `c|${c.url}|${foldName(c.subject ?? "")}|${c.role.toLowerCase()}`;
    return seen.has(k) ? false : (seen.add(k), true);
  });
  out.statements = out.statements.filter(s => {
    const k = `s|${s.url}|${s.quote.toLowerCase()}`;
    return seen.has(k) ? false : (seen.add(k), true);
  });
}
