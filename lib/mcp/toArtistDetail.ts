import { getArtistLinks } from "@/lib/artists/getArtistLinks";
import type { ArtistRow } from "@/lib/artists/types";
import { getPublicArtistAbout } from "@/lib/bio/getPublicArtistAbout";
import { isRealBio } from "@/lib/bio/isRealBio";
import { db } from "@/lib/db/db";
import type { ArtistDetail, SocialLink } from "@/lib/mcp/types";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";

/**
 * What `get_artist` returns: the artist's links keyed by platform, and a bio
 * that is the artist's own only once claimed (the claim nudge is never a bio);
 * before a claim, the directory's public About when it is still current.
 *
 * @param artist - The artist row.
 * @returns The detail.
 */
export async function toArtistDetail(artist: ArtistRow): Promise<ArtistDetail> {
  const [artistLinks, claim] = await Promise.all([
    getArtistLinks(artist),
    findApprovedClaim(db, artist.id),
  ]);
  const claimed = claim?.id ?? null;

  const directoryAbout = claimed ? null : await getPublicArtistAbout(artist.id);
  const socialLinks: Record<string, SocialLink> = {};

  for (const link of artistLinks) {
    const platformName = link.siteName;
    // The siteName "facebookID" is the row property "facebookId".
    const artistPropertyName = link.siteName === "facebookID" ? "facebookId" : link.siteName;
    let handle = (artist as Record<string, unknown>)[artistPropertyName]?.toString() ?? "";
    // YouTube handles are returned without their leading @.
    if (
      (platformName === "youtube" || platformName === "youtubechannel") &&
      handle.startsWith("@")
    ) {
      handle = handle.substring(1);
    }

    socialLinks[platformName] = { handle, url: link.artistUrl };
  }

  return {
    id: artist.id,
    name: artist.name ?? "",
    bio: claimed && isRealBio(artist.bio) ? artist.bio : (directoryAbout?.bio ?? null),
    spotifyId: artist.spotify ?? null,
    deezerId: artist.deezer ?? null,
    socialLinks,
  };
}
