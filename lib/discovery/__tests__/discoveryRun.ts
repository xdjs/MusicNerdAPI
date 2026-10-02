import { URLMAP_BY_SITE } from "@/lib/discovery/__tests__/urlmapRows";
import type { DiscoveryRun } from "@/lib/discovery/types";
import type { ProfileDisplayColumn } from "@/lib/links/types";

/** A fresh discovery run for tier tests. */
export function discoveryRun(
  missing: ProfileDisplayColumn[],
  record: Record<string, unknown> = {},
): DiscoveryRun {
  return {
    artistId: "a1",
    record,
    missing: new Set(missing),
    urlmapBySiteName: URLMAP_BY_SITE,
    ctx: { record, urlmapBySiteName: URLMAP_BY_SITE, seen: new Map() },
    walled: new Set(),
    deadline: Date.now() + 60_000,
    foundCount: 0,
  };
}

/** Drains an async generator. */
export async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of gen) out.push(x);
  return out;
}
