import type { HandleProbe, ProbeHit, TierCandidate } from "@/lib/discovery/types";

/**
 * A probe hit as a tier-3 candidate. Provisional only when the handle was a
 * name-derived guess.
 *
 * @param probe - The probe that hit.
 * @param hit - Its URL and preview.
 * @param artistName - The resolved name.
 * @param note - Where the handle came from, for the reasoning.
 * @returns The candidate.
 */
export function probeCandidate(
  probe: HandleProbe,
  hit: ProbeHit,
  artistName: string,
  note: string,
): TierCandidate {
  return {
    tier: 3,
    provisional: !probe.confirmed,
    platform: probe.platform,
    url: hit.url,
    reasoning: `Handle probe: ${hit.preview.title ? `og:title matched "${artistName}"` : "og:image resolved"} for @${probe.handle} (${note})`,
    preview: hit.preview,
  };
}
