import { VERDICT_BY_TOKEN } from "@/lib/relevance/const";
import type { RelevanceCandidate, RelevanceRow, RelevanceVerdict } from "@/lib/relevance/types";

/**
 * Applies the judge's rows to the verdicts, by index into the batch that was
 * sent, never by a URL the model wrote. An index outside the batch or an
 * unrecognised verdict is ignored, leaving the page undecided.
 *
 * @param rows - The judge's reply.
 * @param judged - The pages sent, in order.
 * @param verdicts - The verdicts by URL; updated in place.
 * @returns Nothing.
 */
export function applyVerdicts(
  rows: RelevanceRow[],
  judged: RelevanceCandidate[],
  verdicts: Map<string, RelevanceVerdict>,
): void {
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const { i, v } = row;
    if (typeof i !== "number" || !Number.isInteger(i) || i < 0 || i >= judged.length) continue;
    const mapped = VERDICT_BY_TOKEN[String(v).toLowerCase()];
    if (!mapped) continue;
    verdicts.set(judged[i].url, mapped);
  }
}
