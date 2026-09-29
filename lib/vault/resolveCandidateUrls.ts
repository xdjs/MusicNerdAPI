import { resolveRedirectUrl } from "@/lib/sources/resolveRedirectUrl";
import type { DiscoveryResult } from "@/lib/vault/types";

/**
 * Resolves every candidate's URL in parallel, so a redirect token becomes its
 * real destination. One that doesn't resolve is dropped, never stored as is.
 *
 * @param results - The search candidates.
 * @returns The candidates with resolved URLs.
 */
export async function resolveCandidateUrls(results: DiscoveryResult[]): Promise<DiscoveryResult[]> {
  const resolved = await Promise.all(
    results
      .filter(r => r.url && r.title)
      .map(async r => {
        const url = await resolveRedirectUrl(r.url);
        return url ? { ...r, url } : null;
      }),
  );
  return resolved.filter((r): r is DiscoveryResult => r !== null);
}
