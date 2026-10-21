import { NextResponse } from "next/server";
import { submitArtistDestination } from "@/lib/artistLinkReview/submitArtistDestination";
import { ArtistLinkConflictError } from "@/lib/artistLinks/ArtistLinkConflictError";
import { clearArtistLink } from "@/lib/artistLinks/clearArtistLink";
import { LINK_NOT_SUPPORTED_LONG } from "@/lib/artistLinks/const";
import { setArtistLink } from "@/lib/artistLinks/setArtistLink";
import { extractArtistId } from "@/lib/artists/extractArtistId";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { canEditArtist } from "@/lib/auth/canEditArtist";
import { db } from "@/lib/db/db";
import { notifyDiscordOfArtistLinkAdded } from "@/lib/directEditLink/notifyDiscordOfArtistLinkAdded";
import { validateDirectEditLinkBody } from "@/lib/directEditLink/validateDirectEditLinkBody";
import { parseMusicDestination } from "@/lib/musicLinks/parseMusicDestination";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";
import { withArtistOperation } from "@/lib/ownership/withArtistOperation";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";
import { getUserById } from "@/lib/users/getUserById";

/**
 * Handles POST /api/directEditLink: the claimant or an admin sets or clears
 * one platform link. `set` refuses song/album URLs, files an Apple Music or
 * Beatport artist page as an approved Lore source, and otherwise writes the
 * urlmap platform's column under the ownership fence, recording the
 * claimant's self-edit. A changed value posts to Discord.
 *
 * @param request - The request; a Privy token and `{ artistId, action, url?, siteName? }`.
 * @returns 200 `{ status, success, siteName?, platformName? }`; 400, 401, 403, 409 or 500.
 */
export async function postDirectEditLinkHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  const error = (message: string, status: number, extra: Record<string, string> = {}) =>
    NextResponse.json({ status: "error", error: message, ...extra }, { status, headers });
  const ok = (body: Record<string, unknown>) =>
    NextResponse.json({ status: "ok", ...body }, { status: 200, headers });
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const body = validateDirectEditLinkBody(await request.json().catch(() => null));
    if (body instanceof NextResponse) return body;
    const { artistId, action, url, siteName } = body;
    const userId = auth.userId;

    const expectedClaimId = (await findApprovedClaim(db, artistId))?.id ?? null;
    if (!(await canEditArtist(userId, artistId)))
      return error("Not authorized for this artist", 403);

    if (action === "set") {
      if (!url) return error("url is required for set action", 400);
      const destination = parseMusicDestination(url);
      if (destination?.kind === "release")
        return error("Add an artist profile link, not a song or album.", 400);
      if (
        destination?.kind === "artist" &&
        ["apple_music", "beatport"].includes(destination.platform)
      ) {
        const result = await submitArtistDestination(artistId, userId, url, expectedClaimId, true);
        return ok({ success: true, siteName: result.platform, platformName: result.label });
      }
      const extracted = await extractArtistId(url);
      if (!extracted?.siteName || !extracted?.id) return error(LINK_NOT_SUPPORTED_LONG, 400);

      const user = await getUserById(userId);
      const { oldValue, artistName } = await withArtistOperation(
        artistId,
        { userId, expectedClaimId },
        () => setArtistLink(artistId, extracted.siteName, extracted.id, url),
      );
      if (oldValue !== extracted.id) {
        await notifyDiscordOfArtistLinkAdded({
          user: user ?? {},
          artistName: artistName ?? artistId,
          platformName: extracted.cardPlatformName ?? extracted.siteName,
          platformId: extracted.id,
          submittedUrl: url,
        });
      }
      return ok({
        success: true,
        siteName: extracted.siteName,
        platformName: extracted.cardPlatformName,
      });
    }

    if (!siteName) return error("siteName is required for clear action", 400);
    await withArtistOperation(artistId, { userId, expectedClaimId }, () =>
      clearArtistLink(artistId, siteName),
    );
    return ok({ success: true });
  } catch (e) {
    if (e instanceof OwnershipChangedError) return error(e.message, 403);
    if (e instanceof ArtistLinkConflictError) return error(e.message, 409, { code: "CONFLICT" });
    console.error("[directEditLink] Error:", e);
    return error("Internal server error", 500);
  }
}
