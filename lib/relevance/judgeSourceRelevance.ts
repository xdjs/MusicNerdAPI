import { z } from "zod";
import { generateArray } from "@/lib/ai/generateArray";
import { withTimeout } from "@/lib/async/withTimeout";
import { anchorBlock } from "@/lib/relevance/anchorBlock";
import { applyVerdicts } from "@/lib/relevance/applyVerdicts";
import {
  JUDGE_TIMEOUT_MS,
  MAX_JUDGED_CANDIDATES,
  RELEVANCE_INSTRUCTION,
} from "@/lib/relevance/const";
import { relevancePage } from "@/lib/relevance/relevancePage";
import type {
  ArtistAnchor,
  RelevanceCandidate,
  RelevanceRow,
  RelevanceVerdict,
} from "@/lib/relevance/types";

/**
 * Is each fetched page about this artist? A model reads up to 12 readable
 * pages against the artist's anchor (name, verified releases, confirmed
 * accounts), which a substring test can't: it can't tell a Chord DAVE
 * amplifier review from Black Dave. Never throws and never rejects on failure:
 * if the model fails or times out, every page stays `undecided` and the
 * caller falls back to the name check.
 *
 * @param anchor - What we can prove about the artist.
 * @param candidates - The fetched pages.
 * @returns A verdict per candidate URL.
 */
export async function judgeSourceRelevance(
  anchor: ArtistAnchor,
  candidates: RelevanceCandidate[],
): Promise<Map<string, RelevanceVerdict>> {
  const verdicts = new Map<string, RelevanceVerdict>();
  for (const c of candidates) verdicts.set(c.url, "undecided");

  // Only pages we could read: guessing from a URL is the failure this removes.
  const judgeable = candidates
    .filter(c => (c.text?.trim().length ?? 0) > 0)
    .slice(0, MAX_JUDGED_CANDIDATES);
  if (judgeable.length === 0) return verdicts;

  const pages = judgeable.map((c, i) => relevancePage(c, i, anchor)).join("\n\n");
  let rows: RelevanceRow[];
  try {
    const response = await withTimeout(
      generateArray({
        prompt: `ARTIST ANCHOR:\n${anchorBlock(anchor)}\n\nPAGES:\n${pages}`,
        instructions: RELEVANCE_INSTRUCTION,
        temperature: 0,
        element: z.object({ i: z.number().optional(), v: z.string().optional() }),
        thinkingBudget: 0,
      }),
      JUDGE_TIMEOUT_MS,
      "relevance judge timeout",
    );
    rows = response.output;
  } catch (e) {
    console.error("[sourceRelevance] judge failed, every candidate stays undecided:", e);
    return verdicts;
  }
  applyVerdicts(rows, judgeable, verdicts);
  return verdicts;
}
