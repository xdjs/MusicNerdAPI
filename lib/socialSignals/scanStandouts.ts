import type { SocialPostRow } from "@/lib/instagram/types";
import { MIN_SAMPLES_FOR_MEDIAN, STANDOUT_MULTIPLE } from "@/lib/socialSignals/const";
import { median } from "@/lib/socialSignals/median";
import { round1 } from "@/lib/socialSignals/round1";
import type { StandoutPost } from "@/lib/socialSignals/types";

/**
 * Records the posts that stand out on one metric, keeping the higher multiple
 * when a post already stands out on another.
 *
 * @param own - The artist's own posts.
 * @param metric - Which metric this pass reads.
 * @param pick - Reads that metric from a post.
 * @param byUrl - Standouts found so far, updated in place.
 */
export function scanStandouts(
  own: SocialPostRow[],
  metric: StandoutPost["metric"],
  pick: (p: SocialPostRow) => number | null,
  byUrl: Map<string, StandoutPost>,
): void {
  const withMetric = own
    .map(p => ({ p, value: pick(p) }))
    .filter(
      (x): x is { p: SocialPostRow; value: number } => typeof x.value === "number" && x.value > 0,
    );
  if (withMetric.length < MIN_SAMPLES_FOR_MEDIAN) return;
  const med = median(withMetric.map(x => x.value));
  if (med <= 0) return;
  for (const { p, value } of withMetric) {
    if (value < med * STANDOUT_MULTIPLE) continue;
    const multiple = round1(value / med);
    const existing = byUrl.get(p.url);
    if (!existing || multiple > existing.multiple) {
      byUrl.set(p.url, { url: p.url, metric, value, median: med, multiple, caption: p.caption });
    }
  }
}
