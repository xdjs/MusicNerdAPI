import type { ArtistRow } from "@/lib/artists/types";
import { LOCAL_LINK_ICONS, SUPPORT_SITES } from "@/lib/links/const";
import { latestExternalUrl } from "@/lib/links/latestExternalUrl";
import type { ArtistLink, LinkSection, ProfileLink } from "@/lib/links/types";

/**
 * The artist's own link columns as profile links, in one section. Spotify and
 * Deezer lead Links from the artist's ids; a monetized or support platform
 * belongs in Support.
 *
 * @param artist - The artist's Spotify and Deezer ids.
 * @param links - The artist's links, as `getArtistLinks` builds them.
 * @param section - "links" or "support".
 * @returns The section's links; unsafe URLs are left out.
 */
export function getProfileLinks(
  artist: Pick<ArtistRow, "spotify" | "deezer">,
  links: ArtistLink[],
  section: LinkSection,
): ProfileLink[] {
  const result: ProfileLink[] = [];
  if (section === "links") {
    if (artist.spotify?.trim())
      result.push({
        siteName: "spotify",
        href: `https://open.spotify.com/artist/${artist.spotify}`,
        label: "Spotify",
        iconSrc: "/siteIcons/spotify_icon.svg",
      });
    if (artist.deezer?.trim())
      result.push({
        siteName: "deezer",
        href: `https://www.deezer.com/artist/${artist.deezer}`,
        label: "Deezer",
        iconSrc: "/siteIcons/deezer_icon.svg",
      });
  }
  for (const link of links) {
    if (link.siteName === "spotify" || link.siteName === "deezer") continue;
    const support = link.isMonetized || SUPPORT_SITES.has(link.siteName);
    const href = latestExternalUrl(link.artistUrl);
    if (href && support === (section === "support"))
      result.push({
        siteName: link.siteName,
        href,
        label: link.cardPlatformName || link.siteName,
        iconSrc: LOCAL_LINK_ICONS[link.siteName] || link.siteImage || "",
      });
  }
  return result;
}
