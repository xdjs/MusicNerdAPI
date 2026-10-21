import { sql } from "drizzle-orm";
import { reviewArtistLinkSuggestion } from "@/lib/artistLinkReview/reviewArtistLinkSuggestion";
import { ArtistLinkConflictError } from "@/lib/artistLinks/ArtistLinkConflictError";
import { db } from "@/lib/db/db";
import { parseMusicDestination } from "@/lib/musicLinks/parseMusicDestination";
import { withArtistOperation } from "@/lib/ownership/withArtistOperation";
import { canonicalizeLoreUrl } from "@/lib/sources/canonicalizeLoreUrl";
import { insertVaultSource } from "@/lib/vault/insertVaultSource";

/**
 * Files an Apple Music or Beatport artist page as a Lore source, attributed to
 * the user as a `link_submission`, the same queue Lore uses. With `approve`
 * the owner's own submission is approved at once; a page already in Lore as
 * pending or approved is approved or shown again instead.
 *
 * @param artistId - The artist.
 * @param userId - The submitting claimant or admin.
 * @param url - The artist page.
 * @param expectedClaimId - The claim the request started under; the insert re-checks it.
 * @param approve - Approve it now.
 * @returns The source id, `applemusic` or `beatport`, and the platform label.
 */
export async function submitArtistDestination(
  artistId: string,
  userId: string,
  url: string,
  expectedClaimId: string | null,
  approve = false,
): Promise<{ id: string; platform: string; label: string }> {
  const destination = parseMusicDestination(url);
  if (destination?.kind !== "artist" || !["apple_music", "beatport"].includes(destination.platform))
    throw new Error("Enter an Apple Music or Beatport artist page, not a song or album.");
  const platform = destination.platform === "apple_music" ? "applemusic" : destination.platform;
  const source = await withArtistOperation(
    artistId,
    { userId, expectedClaimId, trigger: "link_submission", sourceOrigin: "submission" },
    () =>
      insertVaultSource({
        artistId,
        url,
        title: destination.label,
        type: "profile",
        status: "pending",
      }),
  );
  if (!source) {
    if (approve) {
      const [existing] = await db.execute<{ id: string; status: string }>(
        sql`select id,status from artist_vault_sources where artist_id=${artistId}::uuid and url=${canonicalizeLoreUrl(url) ?? url}`,
      );
      if (existing && (existing.status === "pending" || existing.status === "approved")) {
        await reviewArtistLinkSuggestion(artistId, userId, {
          kind: "source",
          id: String(existing.id),
          decision: existing.status === "approved" ? "restore" : "approve",
        });
        return { id: String(existing.id), platform, label: destination.label };
      }
    }
    throw new ArtistLinkConflictError("This link has already been suggested. Review it in Lore.");
  }
  if (approve)
    await reviewArtistLinkSuggestion(artistId, userId, {
      kind: "source",
      id: source.id,
      decision: "approve",
    });
  return { id: source.id, platform, label: destination.label };
}
