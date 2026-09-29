import { getAllLinks } from "@/lib/artists/getAllLinks";
import { getArtistById } from "@/lib/artists/getArtistById";
import { buildLinkPresentationMeta } from "@/lib/links/buildLinkPresentationMeta";
import { PROFILE_DISPLAY_COLUMNS } from "@/lib/links/const";
import type { LinkPresentationMeta } from "@/lib/links/types";
import { getArtistPlatformData } from "@/lib/musicPlatform/getArtistPlatformData";
import { gatherProfilePreviews } from "@/lib/onboarding/gatherProfilePreviews";

/**
 * The profiles card: the artist's links with logos, colours and photo
 * previews, and their streaming follower count. A failed urlmap read degrades
 * the links to their bare shape rather than breaking the turn.
 *
 * @param artistId - The artist.
 * @returns The card's payload. Throws when the artist doesn't exist.
 */
export async function buildProfilesPayload(artistId: string) {
  const artist = await getArtistById(artistId);
  if (!artist) throw new Error(`Artist not found: ${artistId}`);
  const record = artist as unknown as Record<string, unknown>;
  const rawLinks = PROFILE_DISPLAY_COLUMNS.flatMap(col => {
    const value = record[col];
    return typeof value === "string" && value ? [{ siteName: col as string, value }] : [];
  });

  let metaBySiteName: Map<string, LinkPresentationMeta> | null = null;
  try {
    const bySiteName = new Map((await getAllLinks()).map(l => [l.siteName, l]));
    metaBySiteName = new Map(
      rawLinks.map(({ siteName, value }) => [
        siteName,
        buildLinkPresentationMeta(bySiteName.get(siteName), siteName, value),
      ]),
    );
  } catch (e) {
    console.error("[onboarding] getAllLinks failed, degrading profile cards to bare shape:", e);
  }

  const previewTargets: [string, string][] = [];
  for (const [siteName, meta] of metaBySiteName ?? []) {
    if (meta.profileUrl) previewTargets.push([siteName, meta.profileUrl]);
  }
  // Previews and enrichment run together so they don't stack on the turn's budget.
  const [previewBySiteName, enrichment] = await Promise.all([
    gatherProfilePreviews(previewTargets),
    getArtistPlatformData(artist).catch(() => null),
  ]);

  const links = rawLinks.map(({ siteName, value }) => {
    const meta = metaBySiteName?.get(siteName);
    if (!meta) return { siteName, value };
    const previewImage = meta.profileUrl ? (previewBySiteName.get(siteName) ?? null) : null;
    return { siteName, value, ...meta, previewImage };
  });

  return {
    artistName: artist.name ?? "your profile",
    links,
    enrichment: enrichment
      ? {
          platform: enrichment.platform,
          followerCount: enrichment.followerCount,
          imageUrl: enrichment.imageUrl,
        }
      : null,
  };
}
