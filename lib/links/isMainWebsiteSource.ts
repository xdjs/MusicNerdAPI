import { canonicalizeDestinationUrl } from "@/lib/links/canonicalizeDestinationUrl";
import type { DestinationSource } from "@/lib/links/types";
import { normalizePublicUrl } from "@/lib/sources/normalizePublicUrl";

/**
 * Whether a website source is the artist's main site rather than a page
 * under another approved website source: owning a site doesn't make every
 * page of it a destination.
 *
 * @param source - The source.
 * @param sources - The artist's other sources.
 * @returns True for a website source no other approved website source contains.
 */
export function isMainWebsiteSource(
  source: DestinationSource,
  sources: DestinationSource[] = [],
): boolean {
  const href = normalizePublicUrl(source.url);
  if (source.type !== "website" || !href) return false;
  const page = new URL(href);
  const path = page.pathname.replace(/\/+$/, "");
  return !sources.some(candidate => {
    if (
      candidate.podcastEpisodeKey ||
      candidate.type !== "website" ||
      (candidate.status && candidate.status !== "approved")
    )
      return false;
    const mainHref = normalizePublicUrl(candidate.url);
    if (!mainHref || canonicalizeDestinationUrl(mainHref) === canonicalizeDestinationUrl(href))
      return false;
    const main = new URL(mainHref);
    const mainPath = main.pathname.replace(/\/+$/, "");
    return (
      main.origin === page.origin &&
      !main.search &&
      !main.hash &&
      (path.startsWith(`${mainPath}/`) || (path === mainPath && !!(page.search || page.hash)))
    );
  });
}
