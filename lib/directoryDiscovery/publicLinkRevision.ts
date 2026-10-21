import { createHash } from "node:crypto";
import type { ArtistRow } from "@/lib/artists/types";
import { getProfileLinks } from "@/lib/links/getProfileLinks";
import { getSourceLinks } from "@/lib/links/getSourceLinks";
import type { ArtistLink } from "@/lib/artists/types";
import type { DestinationSource } from "@/lib/links/types";

/**
 * A fingerprint of the profile's public destinations only: its link columns
 * and the approved sources shown as links. Private sources and Lore changes
 * don't move it.
 *
 * @param artist - The artist's Spotify and Deezer ids.
 * @param links - The artist's links, as `getArtistLinks` builds them.
 * @param sources - The artist's approved sources.
 * @param blockedIds - Sources hidden by the artist or conflicting with identity decisions.
 * @returns The SHA-256 of the sorted destinations, in hex.
 */
export function publicLinkRevision(
  artist: Pick<ArtistRow, "spotify" | "deezer">,
  links: ArtistLink[],
  sources: (DestinationSource & { id: string; filePath?: string | null })[],
  blockedIds: string[],
): string {
  const profileLinks = [
    ...getProfileLinks(artist, links, "links"),
    ...getProfileLinks(artist, links, "support"),
  ];
  const visible = sources.filter(source => !source.filePath && !blockedIds.includes(source.id));
  const destinations = [
    ...profileLinks,
    ...getSourceLinks(visible, profileLinks, "links"),
    ...getSourceLinks(visible, profileLinks, "support"),
  ]
    .map(({ siteName, href }) => [siteName, href])
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return createHash("sha256").update(JSON.stringify(destinations)).digest("hex");
}
