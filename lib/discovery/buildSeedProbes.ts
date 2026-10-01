import { withoutAt } from "@/lib/artists/withoutAt";
import { HANDLE_BASED_PLATFORM_DOMAINS } from "@/lib/discovery/const";
import { deriveNameSlugs } from "@/lib/discovery/deriveNameSlugs";

/**
 * The handles tier 3 starts from: the artist's existing handle-shaped links
 * (confirmed), then slugs derived from the name (guesses), deduped.
 *
 * @param artistName - The resolved name.
 * @param record - The artist row.
 * @returns Handles with their source and whether they're confirmed.
 */
export function buildSeedProbes(
  artistName: string,
  record: Record<string, unknown>,
): { handle: string; source: string; confirmed: boolean }[] {
  const seen = new Set<string>();
  const seeds: { handle: string; source: string; confirmed: boolean }[] = [];
  for (const col of Object.keys(HANDLE_BASED_PLATFORM_DOMAINS)) {
    const raw = record[col];
    if (typeof raw !== "string" || !raw) continue;
    const handle = withoutAt(raw.trim());
    if (!handle || seen.has(handle)) continue;
    seen.add(handle);
    seeds.push({ handle, source: `existing ${col} handle`, confirmed: true });
  }
  for (const slug of deriveNameSlugs(artistName)) {
    if (seen.has(slug)) continue;
    seen.add(slug);
    seeds.push({ handle: slug, source: "derived from artist name", confirmed: false });
  }
  return seeds;
}
