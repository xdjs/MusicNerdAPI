import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { advanceResearch } from "@/lib/research/advanceResearch";
import { ADVANCE_MAX_DURATION_S, MIN_SLICE_MS, RESPONSE_RESERVE_MS } from "@/lib/research/const";
import type { AdvanceResult } from "@/lib/research/types";

/**
 * Handles GET /api/research/advance, the scheduler's entry point. Takes
 * slices until the budget runs out, and stops the moment the queue is empty,
 * so an idle tick costs one database round trip. A job that is waiting on
 * Apify is set aside for the rest of the tick, or the loop would poll the
 * same scrape until the invocation expired.
 *
 * @param request - The request; must carry `Bearer $CRON_SECRET` when one is set.
 * @returns 200 with every slice taken, or 401 without the secret.
 */
export async function getResearchAdvanceHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  const started = Date.now();
  const secret = process.env.CRON_SECRET ?? "";
  // Unset, this stays as open as POST, which keeps local and preview working.
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json(
      { status: "error", error: "unauthorized", ran: false },
      { status: 401, headers },
    );
  }

  const deadline = started + ADVANCE_MAX_DURATION_S * 1000 - RESPONSE_RESERVE_MS;
  const slices: AdvanceResult[] = [];
  const waiting: string[] = [];
  try {
    while (Date.now() < deadline - MIN_SLICE_MS) {
      const result = await advanceResearch({
        budgetMs: deadline - Date.now(),
        excludeJobIds: [...waiting],
      });
      if (!result.ran) break;
      if (result.waiting && result.jobId) waiting.push(result.jobId);
      slices.push(result);
    }
    console.debug(
      `[research/advance] cron ran ${slices.length} slice(s) in ${Date.now() - started}ms`,
    );
    return NextResponse.json({ status: "ok", ran: slices.length > 0, slices }, { headers });
  } catch (e) {
    console.error("[research/advance] cron error:", e);
    return NextResponse.json(
      { status: "error", error: "advance failed", ran: slices.length > 0, slices },
      { headers },
    );
  }
}
