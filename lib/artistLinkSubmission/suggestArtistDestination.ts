import { ArtistLinkConflictError } from "@/lib/artistLinks/ArtistLinkConflictError";
import { parseMusicDestination } from "@/lib/musicLinks/parseMusicDestination";
import { insertVaultSource } from "@/lib/vault/insertVaultSource";

/**
 * Files a contributor's Apple Music or Beatport artist page as a pending Lore
 * source, attributed to them as a `link_submission`, for the claimant or an
 * admin to review. Unlike `submitArtistDestination`, it runs outside an artist
 * operation: suggesting needs no claim.
 *
 * @param artistId - The artist.
 * @param userId - The signed-in contributor.
 * @param url - The artist page.
 * @returns `applemusic` or `beatport`, and the platform label. Throws ArtistLinkConflictError when Lore already has the page.
 */
export async function suggestArtistDestination(
  artistId: string,
  userId: string,
  url: string,
): Promise<{ platform: string; label: string }> {
  const destination = parseMusicDestination(url);
  if (destination?.kind !== "artist" || !["apple_music", "beatport"].includes(destination.platform))
    throw new Error("Enter an Apple Music or Beatport artist page, not a song or album.");
  const source = await insertVaultSource(
    { artistId, url, title: destination.label, type: "profile", status: "pending" },
    { userId, trigger: "link_submission" },
  );
  if (!source)
    throw new ArtistLinkConflictError("This link has already been suggested. Review it in Lore.");
  return {
    platform: destination.platform === "apple_music" ? "applemusic" : destination.platform,
    label: destination.label,
  };
}
