import { getLatestProviderFailure } from "./getLatestProviderFailure";
import type { ResearchJob } from "@/lib/research/types";
import type { LatestRefreshState, SourceResult } from "@/lib/latest/types";
import { latestProviderAccount } from "./latestProviderAccount";
import { fetchLatestProviderItems } from "./fetchLatestProviderItems";
import { persistLatestProviderSnapshot } from "./persistLatestProviderSnapshot";
import type { LatestProvider, LatestProviderItem } from "./types";
/** One explicit worker provider refresh, with fetch failure distinct from storage/ownership failures. */
export async function refreshLatestProvider(
  job: ResearchJob,
  provider: LatestProvider,
): Promise<SourceResult & { stale?: boolean }> {
  const state = job.state as unknown as LatestRefreshState;
  const accountId = latestProviderAccount(provider, state[provider]);
  if (!accountId) return { status: "disconnected" };
  let items: LatestProviderItem[] | null;
  try {
    items = await fetchLatestProviderItems(provider, accountId);
    if (items.length > 50 || Buffer.byteLength(JSON.stringify(items)) > 400000)
      throw Object.assign(new Error("Latest snapshot exceeds budget"), {
        latestPhase: "snapshot",
        latestCode: "snapshot_too_large",
      });
  } catch (error) {
    console.warn("[latest/provider]", { provider, ...getLatestProviderFailure(error) });
    items = null;
  }
  if ((await persistLatestProviderSnapshot(job, provider, accountId, items)) === false)
    return { status: "pending", stale: true };
  return items === null
    ? { status: "failed" }
    : { status: "checked", checkedAt: new Date().toISOString() };
}
