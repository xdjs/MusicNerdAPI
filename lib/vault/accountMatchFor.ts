import { extractArtistId } from "@/lib/artists/extractArtistId";
import { isReservedHandle } from "@/lib/artists/isReservedHandle";
import type { ExtractedArtistId } from "@/lib/artists/types";
import { stripQuery } from "@/lib/sources/stripQuery";
import { ACCOUNT_PLATFORMS, REFERENCE_PLATFORMS } from "@/lib/vault/const";

/**
 * The platform and handle a URL points at, and whether it's an account the
 * artist could own. Wikipedia and IMDb ids are article titles about a subject,
 * so they never count, and a reserved route (`instagram.com/p/…` reads as the
 * handle "p") never counts either.
 *
 * @param url - A search result.
 * @returns The match, if any, and whether it's an adoptable account URL.
 */
export async function accountMatchFor(
  url: string,
): Promise<{ match: ExtractedArtistId | null | undefined; isAccountUrl: boolean }> {
  const match = await extractArtistId(stripQuery(url)).catch(() => undefined);
  const isAccountUrl =
    !!match?.siteName &&
    !!match?.id &&
    (ACCOUNT_PLATFORMS.has(match.siteName) || REFERENCE_PLATFORMS.has(match.siteName)) &&
    !isReservedHandle(match.siteName, match.id);
  return { match, isAccountUrl };
}
