import { canonicalizeDestinationUrl } from "@/lib/links/canonicalizeDestinationUrl";
import { MUSIC_ICONS } from "@/lib/links/const";
import { isDestinationSource } from "@/lib/links/isDestinationSource";
import type { DestinationSource, LinkSection, ProfileLink, SourceLink } from "@/lib/links/types";
import { websiteDestinationLabel } from "@/lib/links/websiteDestinationLabel";
import { parseMusicDestination } from "@/lib/musicLinks/parseMusicDestination";
import { normalizePublicUrl } from "@/lib/sources/normalizePublicUrl";

/**
 * The profile links approved sources add, in one section: catalog profiles
 * and the artist's website. Sources keep their review and provenance while
 * shown as destinations; one already linked, or a platform already shown, is skipped.
 *
 * @param sources - The artist's sources.
 * @param existingLinks - The links already shown.
 * @param section - "links", or "support" for the destinations that sell or fund.
 * @returns The source-backed links, website sources first.
 */
export function getSourceLinks(
  sources: (DestinationSource & { id: string; title?: string | null })[],
  existingLinks: ProfileLink[] = [],
  section: LinkSection = "links",
): SourceLink[] {
  const result: SourceLink[] = [];
  const seen = new Set(
    existingLinks.map(link => (link.siteName === "applemusic" ? "apple_music" : link.siteName)),
  );
  const urls = new Set(existingLinks.map(link => canonicalizeDestinationUrl(link.href)));
  // Explicit website destinations predate URL-based routing and stay first.
  const ordered = [...sources].sort(
    (a, b) => Number(b.type === "website") - Number(a.type === "website"),
  );
  for (const source of ordered) {
    const href = normalizePublicUrl(source.url);
    if (
      !href ||
      !isDestinationSource(source, sources) ||
      (source.status && source.status !== "approved")
    )
      continue;
    const destination = parseMusicDestination(href);
    if (!destination && source.type !== "website") continue;
    if ((destination?.support ?? false) !== (section === "support")) continue;
    const urlKey = canonicalizeDestinationUrl(href);
    if (urls.has(urlKey)) continue;
    if (destination?.kind === "artist" && seen.has(destination.platform)) continue;
    const label = destination
      ? destination.kind === "release" && source.title?.trim()
        ? `${source.title.trim()} · ${destination.label}`
        : destination.label
      : websiteDestinationLabel(href);
    const siteName =
      destination?.kind === "artist"
        ? destination.platform === "apple_music"
          ? "applemusic"
          : destination.platform
        : `source:${source.id}`;
    result.push({
      siteName,
      href,
      label,
      iconSrc: destination
        ? (MUSIC_ICONS[destination.platform] ?? "/siteIcons/music_icon.svg")
        : "/siteIcons/website_icon.svg",
      sourceId: source.id,
      kind: destination?.kind ?? "website",
    });
    if (destination?.kind === "artist") seen.add(destination.platform);
    urls.add(urlKey);
  }
  return result;
}
