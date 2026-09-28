import { APIFY_CONTROL_TIMEOUT_MS, APIFY_RUN_URL } from "@/lib/instagram/const";
import type { ApifyRunState } from "@/lib/instagram/types";

/**
 * Where a started Apify run has got to.
 *
 * @param runId - The run.
 * @returns "ready" with its dataset, "running", or "failed" with a reason.
 */
export async function checkInstagramScrape(runId: string): Promise<ApifyRunState> {
  const token = process.env.APIFY_API_TOKEN ?? "";
  if (!token) return { status: "failed", reason: "no apify token" };
  try {
    const res = await fetch(`${APIFY_RUN_URL(runId)}?token=${encodeURIComponent(token)}`, {
      signal: AbortSignal.timeout(APIFY_CONTROL_TIMEOUT_MS),
    });
    if (!res.ok) return { status: "failed", reason: `apify status ${res.status}` };
    const body = (await res.json()) as { data?: { status?: string; defaultDatasetId?: string } };
    const state = body?.data?.status;
    const datasetId = body?.data?.defaultDatasetId;
    if (state === "SUCCEEDED" && datasetId) return { status: "ready", runId, datasetId };
    if (state === "READY" || state === "RUNNING") return { status: "running", runId };
    return { status: "failed", reason: `apify run ${state ?? "unknown"}` };
  } catch (e) {
    return { status: "failed", reason: e instanceof Error ? e.message : "apify status failed" };
  }
}
