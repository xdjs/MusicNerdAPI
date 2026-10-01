import { mapWithConcurrency } from "@/lib/async/mapWithConcurrency";
import { buildSeedProbes } from "@/lib/discovery/buildSeedProbes";
import {
  HANDLE_BASED_PLATFORM_DOMAINS,
  MAX_DERIVED_SLUGS,
  PROBE_CONCURRENCY,
  PROBE_UNVERIFIABLE_PLATFORMS,
} from "@/lib/discovery/const";
import { probeCandidate } from "@/lib/discovery/probeCandidate";
import { runHandleProbe } from "@/lib/discovery/runHandleProbe";
import type { HandleProbe, TierCandidate } from "@/lib/discovery/types";
import type { ProfileDisplayColumn, UrlmapPresentationRow } from "@/lib/links/types";

/**
 * Tier 3: probe candidate handles directly, in two passes. The seed pass tries
 * existing handles and name slugs on every missing handle platform; the
 * propagate pass retries handles it confirmed on whatever is still missing,
 * so one confirmed handle resolves the other platforms that reuse it. Budget-
 * and concurrency-capped, and never the same pair twice.
 *
 * @param artistName - The resolved name.
 * @param record - The artist row.
 * @param missing - Columns still to find.
 * @param urlmapBySiteName - urlmap rows by column.
 * @param walled - Collects platforms that walled a probe.
 * @yields `[platform, candidate | null]` once per probed platform, misses last.
 */
export async function* tierThreeHandleProbeStream(
  artistName: string,
  record: Record<string, unknown>,
  missing: Set<ProfileDisplayColumn>,
  urlmapBySiteName: Map<string, UrlmapPresentationRow>,
  walled?: Set<ProfileDisplayColumn>,
): AsyncGenerator<[ProfileDisplayColumn, TierCandidate | null]> {
  const targets = (Object.keys(HANDLE_BASED_PLATFORM_DOMAINS) as ProfileDisplayColumn[]).filter(
    p => missing.has(p) && !PROBE_UNVERIFIABLE_PLATFORMS.has(p),
  );
  if (targets.length === 0) return;
  const resolved = new Map<ProfileDisplayColumn, TierCandidate>();
  const tried = new Set<string>();
  let budget = MAX_DERIVED_SLUGS * targets.length;

  const seedJobs: HandleProbe[] = [];
  for (const { handle, source, confirmed } of buildSeedProbes(artistName, record)) {
    for (const platform of targets) {
      const key = `${platform}|${handle}`;
      if (tried.has(key) || budget <= 0) continue;
      tried.add(key);
      budget--;
      seedJobs.push({ platform, handle, source, confirmed });
    }
  }
  const newlyConfirmed = new Set<string>();
  for await (const [probe, hit] of mapWithConcurrency(seedJobs, PROBE_CONCURRENCY, p =>
    runHandleProbe(p, urlmapBySiteName, artistName, walled),
  )) {
    if (!hit || resolved.has(probe.platform)) continue;
    const candidate = probeCandidate(probe, hit, artistName, probe.source);
    resolved.set(probe.platform, candidate);
    newlyConfirmed.add(probe.handle);
    yield [probe.platform, candidate];
  }

  const stillMissing = targets.filter(p => !resolved.has(p));
  if (stillMissing.length > 0 && newlyConfirmed.size > 0 && budget > 0) {
    const propagationJobs: HandleProbe[] = [];
    for (const handle of newlyConfirmed) {
      for (const platform of stillMissing) {
        const key = `${platform}|${handle}`;
        if (tried.has(key) || budget <= 0) continue;
        tried.add(key);
        budget--;
        propagationJobs.push({ platform, handle, source: "propagated", confirmed: true });
      }
    }
    for await (const [probe, hit] of mapWithConcurrency(propagationJobs, PROBE_CONCURRENCY, p =>
      runHandleProbe(p, urlmapBySiteName, artistName, walled),
    )) {
      if (!hit || resolved.has(probe.platform)) continue;
      const candidate = probeCandidate(
        probe,
        hit,
        artistName,
        "propagated from a handle confirmed on another platform",
      );
      resolved.set(probe.platform, candidate);
      yield [probe.platform, candidate];
    }
  }

  for (const platform of targets) if (!resolved.has(platform)) yield [platform, null];
}
