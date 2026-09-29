import {
  BATCH_CONCURRENCY,
  MIN_CALL_BUDGET_MS,
  POSTS_PER_BATCH,
  TIMEOUT_MS,
} from "@/lib/credits/const";
import { captionBearingPosts } from "@/lib/credits/captionBearingPosts";
import { dedupeExtraction } from "@/lib/credits/dedupeExtraction";
import { runCaptionBatch } from "@/lib/credits/runCaptionBatch";
import type { CaptionExtraction, ExtractionSlice } from "@/lib/credits/types";
import type { SocialPostRow } from "@/lib/instagram/types";

/**
 * Reads as much of an artist's captions as fits in the time available, and
 * says where to resume. A 300-post feed takes about seven minutes and no
 * invocation lives that long, so the caller persists `nextBatch` and calls
 * again from another slice. Never throws.
 *
 * @param allPosts - The artist's stored posts.
 * @param artistName - The artist's name.
 * @param artistHandle - The artist's handle.
 * @param opts - Where to start and how long to take.
 * @param opts.startBatch - The batch to resume from.
 * @param opts.budgetMs - The time available; unlimited when omitted.
 * @returns What this slice found and where it stopped.
 */
export async function extractCaptionCredits(
  allPosts: SocialPostRow[],
  artistName: string,
  artistHandle: string,
  opts?: { startBatch?: number; budgetMs?: number },
): Promise<ExtractionSlice> {
  const posts = captionBearingPosts(allPosts);
  const batches: SocialPostRow[][] = [];
  for (let i = 0; i < posts.length; i += POSTS_PER_BATCH)
    batches.push(posts.slice(i, i + POSTS_PER_BATCH));

  const start = Math.max(0, opts?.startBatch ?? 0);
  const deadline = Date.now() + (opts?.budgetMs ?? Number.POSITIVE_INFINITY);
  const out: CaptionExtraction = { credits: [], statements: [] };

  if (batches.length === 0 || start >= batches.length) {
    return { extraction: out, nextBatch: batches.length, totalBatches: batches.length, done: true };
  }

  // A call gets its own ceiling or whatever the caller has left, whichever is
  // sooner, and never more: a slow call must not outlive the invocation.
  const bounded = Number.isFinite(deadline);
  const callBudget = bounded
    ? Math.min(TIMEOUT_MS, Math.max(0, deadline - Date.now()))
    : TIMEOUT_MS;

  let i = start;
  let failed = false;
  while (i < batches.length) {
    // Too little left to start a call without spending the persistence reserve.
    if (bounded && deadline - Date.now() < MIN_CALL_BUDGET_MS) break;
    // Stop BEFORE starting a batch we cannot finish.
    if (Date.now() + callBudget > deadline && i > start) break;

    const group = batches.slice(i, i + BATCH_CONCURRENCY);
    const results = await Promise.all(
      group.map((batch, n) =>
        runCaptionBatch(batch, artistName, artistHandle, String(i + n), callBudget),
      ),
    );
    // Stop at the first batch we could not read, and do not advance past it.
    let advanced = 0;
    for (const r of results) {
      if (r === null) {
        failed = true;
        break;
      }
      out.credits.push(...r.credits);
      out.statements.push(...r.statements);
      advanced += 1;
    }
    i += advanced;
    if (failed) break;
  }

  dedupeExtraction(out);
  const done = !failed && i >= batches.length;
  console.debug(
    `[socialCredits] ${artistName}: batches ${start}-${i - 1} of ${batches.length}, ${out.credits.length} credit(s), ${out.statements.length} statement(s)${done ? " — complete" : ""}`,
  );
  return { extraction: out, nextBatch: i, totalBatches: batches.length, done, failed };
}
