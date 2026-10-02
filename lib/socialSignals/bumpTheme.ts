import { pushEvidence } from "@/lib/socialSignals/pushEvidence";
import type { Theme, ThemeTally } from "@/lib/socialSignals/types";

/**
 * Counts one more post for a theme and keeps the post as evidence.
 *
 * @param tally - The running counts.
 * @param term - The term, lowercase.
 * @param kind - Hashtag, caption word or caption phrase.
 * @param url - The post it came from.
 */
export function bumpTheme(tally: ThemeTally, term: string, kind: Theme["kind"], url: string): void {
  const key = `${kind}:${term}`;
  const entry = tally.get(key) ?? { kind, count: 0, evidenceUrls: [] };
  entry.count += 1;
  pushEvidence(entry.evidenceUrls, url);
  tally.set(key, entry);
}
