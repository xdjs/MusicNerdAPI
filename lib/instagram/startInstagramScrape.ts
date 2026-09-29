import {
  APIFY_CONTROL_TIMEOUT_MS,
  APIFY_RUNS_URL,
  DEFAULT_SCRAPE_LIMIT,
  MAX_SCRAPE_LIMIT,
} from "@/lib/instagram/const";
import type { ApifyRunState } from "@/lib/instagram/types";

/**
 * Starts an Apify scrape of the profile and returns as soon as it has an id.
 * A scrape takes one to five minutes; later slices poll it.
 *
 * @param handle - The Instagram handle, with or without "@".
 * @param opts - Scrape options.
 * @param opts.limit - Posts to fetch, default 200, capped at 300.
 * @returns "started" with the run id, or "failed" with a reason.
 */
export async function startInstagramScrape(
  handle: string,
  opts?: { limit?: number },
): Promise<ApifyRunState> {
  const token = process.env.APIFY_API_TOKEN ?? "";
  if (!token) return { status: "failed", reason: "no apify token" };
  const limit = Math.min(Math.max(1, opts?.limit ?? DEFAULT_SCRAPE_LIMIT), MAX_SCRAPE_LIMIT);
  try {
    const res = await fetch(`${APIFY_RUNS_URL}?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        directUrls: [`https://www.instagram.com/${handle.trim().replace(/^@/, "")}/`],
        resultsType: "posts",
        resultsLimit: limit,
        addParentData: false,
      }),
      signal: AbortSignal.timeout(APIFY_CONTROL_TIMEOUT_MS),
    });
    if (!res.ok) return { status: "failed", reason: `apify start ${res.status}` };
    const body = (await res.json()) as { data?: { id?: string } };
    const runId = body?.data?.id;
    return runId
      ? { status: "started", runId }
      : { status: "failed", reason: "apify returned no run id" };
  } catch (e) {
    return { status: "failed", reason: e instanceof Error ? e.message : "apify start failed" };
  }
}
