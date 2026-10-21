import { canonicalizeDestinationUrl } from "@/lib/sources/canonicalizeDestinationUrl";
import { normalizePublicUrl } from "@/lib/sources/normalizePublicUrl";

type WebsiteSource = {
  url: string;
  type?: string | null;
  status?: string;
  podcastEpisodeKey?: string | null;
};

/**
 * Is this website source the artist's main site rather than a page under it?
 * Website ownership alone does not make every page a primary destination.
 *
 * @param source - The source.
 * @param sources - The artist's other sources, to find a main site above it.
 * @returns True for a `website` source no approved website source sits above.
 */
export function isMainWebsiteSource(source: WebsiteSource, sources: WebsiteSource[] = []): boolean {
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
