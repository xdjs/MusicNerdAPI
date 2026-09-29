import { extractArtistId } from "@/lib/artists/extractArtistId";
import { titleMatchesArtist } from "@/lib/artists/titleMatchesArtist";
import { handleEchoesArtistName } from "@/lib/discovery/handleEchoesArtistName";
import { isReservedBandcampSubdomain } from "@/lib/discovery/isReservedBandcampSubdomain";
import { looksLikeProfileUrl } from "@/lib/discovery/looksLikeProfileUrl";
import { stripHandleAndBoilerplate } from "@/lib/discovery/stripHandleAndBoilerplate";
import { stripUrlQuery } from "@/lib/discovery/stripUrlQuery";
import type { ProfileDisplayColumn } from "@/lib/links/types";
import type { WebSearchResult } from "@/lib/search/types";
import { foldName } from "@/lib/text/foldName";

/**
 * Does a tier-4 search result earn a place as a candidate? It must look like
 * a profile URL, resolve to the platform searched, and its handle must echo
 * the name. A title naming someone else fails it; no usable title doesn't.
 * The snippet is never used: prose can contain a common-word artist name.
 *
 * @param result - The search hit.
 * @param platform - The platform the search was scoped to.
 * @param artistName - The resolved name.
 * @returns True to keep it as a candidate.
 */
export async function resultPassesNameCheck(
  result: WebSearchResult,
  platform: ProfileDisplayColumn,
  artistName: string,
): Promise<boolean> {
  const url = stripUrlQuery(result.url);
  if (!looksLikeProfileUrl(url)) return false;
  if (platform === "bandcamp" && isReservedBandcampSubdomain(url)) return false;
  let extracted;
  try {
    extracted = await extractArtistId(url);
  } catch {
    return false;
  }
  if (!extracted?.siteName || !extracted?.id || extracted.siteName !== platform) return false;
  if (!handleEchoesArtistName(extracted.id, artistName)) return false;
  const residual = result.title ? stripHandleAndBoilerplate(result.title, extracted.id) : "";
  if (foldName(residual) && !titleMatchesArtist(residual, artistName)) return false;
  return true;
}
