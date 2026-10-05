import { extractArtistId } from "@/lib/artists/extractArtistId";
import { normalizeHandle } from "@/lib/instagram/normalizeHandle";
import { stripQuery } from "@/lib/sources/stripQuery";
import { MAX_CORROBORATION_CHECKS } from "@/lib/vault/const";
import { parseMusicDestination } from "@/lib/musicLinks/parseMusicDestination";
import { getReleaseArtistHandle } from "@/lib/musicLinks/getReleaseArtistHandle";
import type { ResolvedHandle } from "@/lib/vault/types";

/**
 * A page's outbound links resolved to platform handles, once: corroboration and
 * adoption both read this list, rather than resolving every link twice.
 *
 * @param outboundLinks - The page's off-host links.
 * @returns The links that name a platform handle, normalized.
 */
export async function resolveOutboundHandles(outboundLinks: string[]): Promise<ResolvedHandle[]> {
  const resolved: ResolvedHandle[] = [];
  for (const link of outboundLinks.slice(0, MAX_CORROBORATION_CHECKS)) {
    const music = parseMusicDestination(link);
    const match =
      music?.kind === "release"
        ? getReleaseArtistHandle(music)
        : await extractArtistId(stripQuery(link)).catch(() => undefined);
    if (match?.siteName && match?.id)
      resolved.push({ siteName: match.siteName, id: normalizeHandle(String(match.id)) });
  }
  return resolved;
}
