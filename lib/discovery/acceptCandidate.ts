import type { DiscoveryEvent, DiscoveryRun, TierCandidate } from "@/lib/discovery/types";
import { validateCandidate } from "@/lib/discovery/validateCandidate";

/**
 * Validates a tier's candidate and, when it passes, counts it for the run.
 *
 * @param run - The discovery run.
 * @param candidate - The candidate.
 * @returns A `found` event, or null.
 */
export async function acceptCandidate(
  run: DiscoveryRun,
  candidate: TierCandidate,
): Promise<DiscoveryEvent | null> {
  const profile = await validateCandidate(candidate, run.ctx);
  if (!profile) return null;
  run.foundCount++;
  return { kind: "found", profile };
}
