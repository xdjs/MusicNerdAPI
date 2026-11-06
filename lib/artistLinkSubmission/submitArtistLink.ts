import { and, eq } from "drizzle-orm";
import { approveUGC } from "@/lib/artistLinkReview/approveUGC";
import { ArtistLinkConflictError } from "@/lib/artistLinks/ArtistLinkConflictError";
import { LINK_NOT_SUPPORTED_LONG } from "@/lib/artistLinks/const";
import { getArtistLinkValue } from "@/lib/artistLinks/getArtistLinkValue";
import { suggestArtistDestination } from "@/lib/artistLinkSubmission/suggestArtistDestination";
import type { RefusedArtistLink, SubmittedArtistLink } from "@/lib/artistLinkSubmission/types";
import { extractArtistId } from "@/lib/artists/extractArtistId";
import type { ArtistRow } from "@/lib/artists/types";
import { db } from "@/lib/db/db";
import { ugcresearch } from "@/lib/db/schema";
import { notifyDiscordOfArtistLinkAdded } from "@/lib/directEditLink/notifyDiscordOfArtistLinkAdded";
import { parseMusicDestination } from "@/lib/musicLinks/parseMusicDestination";
import { maybePingDiscordForPendingUGC } from "@/lib/ugc/maybePingDiscordForPendingUGC";
import { getUserById } from "@/lib/users/getUserById";

/**
 * A contributor suggests a platform link, as MusicNerdWeb's `addArtistData`
 * did. It is filed as a UGC row; an admin's or whitelisted user's is approved
 * onto the profile at once, anyone else's waits and pings the reviewers. An
 * Apple Music or Beatport artist page goes to Lore instead. The team's
 * Discord hears about every UGC submission.
 *
 * @param artist - The artist row.
 * @param userId - The signed-in contributor.
 * @param url - The submitted URL.
 * @returns What was saved, or a 400/409 refusal. Throws on anything else.
 */
export async function submitArtistLink(
  artist: ArtistRow,
  userId: string,
  url: string,
): Promise<SubmittedArtistLink | RefusedArtistLink> {
  const destination = parseMusicDestination(url);
  if (destination?.kind === "release")
    return { status: 400, error: "Add an artist profile link, not a song or album." };
  try {
    if (
      destination?.kind === "artist" &&
      ["apple_music", "beatport"].includes(destination.platform)
    ) {
      const { platform, label } = await suggestArtistDestination(artist.id, userId, url);
      return {
        approved: false,
        siteName: platform,
        platformName: label,
        message: "Thanks for adding, the artist or an admin can review this link in Lore",
      };
    }

    const extracted = await extractArtistId(url);
    if (!extracted) return { status: 400, error: LINK_NOT_SUPPORTED_LONG };

    const user = await getUserById(userId);
    const trusted = !!(user?.isAdmin || user?.isWhiteListed);

    // A link that is on the profile can't be added twice; one removed since can.
    const earlier = await db.query.ugcresearch.findFirst({
      where: and(eq(ugcresearch.ugcUrl, url), eq(ugcresearch.artistId, artist.id)),
    });
    if (earlier && getArtistLinkValue(artist, extracted.siteName))
      return { status: 409, error: "This artist data has already been added" };

    const [submission] = await db
      .insert(ugcresearch)
      .values({
        ugcUrl: url,
        origin: "submission",
        siteName: extracted.siteName,
        siteUsername: extracted.id,
        artistId: artist.id,
        name: artist.name ?? "",
        userId,
        accepted: false,
      })
      .returning();

    if (trusted && submission?.id) {
      await db.transaction(tx =>
        approveUGC(submission.id, artist.id, extracted.siteName, extracted.id, tx),
      );
    } else {
      await maybePingDiscordForPendingUGC();
    }

    if (user) {
      await notifyDiscordOfArtistLinkAdded({
        user,
        artistName: artist.name ?? artist.id,
        platformName: extracted.cardPlatformName ?? extracted.siteName,
        platformId: extracted.id,
        submittedUrl: url,
        createdAt: submission?.createdAt ?? undefined,
      });
    }

    return {
      approved: trusted,
      siteName: extracted.siteName,
      platformName: extracted.cardPlatformName,
      message: trusted
        ? "We updated the artist with that data"
        : "Thanks for adding, we'll review this addition before posting",
    };
  } catch (e) {
    if (e instanceof ArtistLinkConflictError) return { status: 409, error: e.message };
    throw e;
  }
}
