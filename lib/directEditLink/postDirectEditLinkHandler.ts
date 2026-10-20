import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { canEditArtist } from "@/lib/auth/canEditArtist";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { extractArtistId } from "@/lib/artists/extractArtistId";
import { setArtistLink } from "@/lib/artistLinks/setArtistLink";
import { clearArtistLink } from "@/lib/artistLinks/clearArtistLink";
import { ArtistLinkConflictError } from "@/lib/artistLinks/ArtistLinkConflictError";

const bodySchema = z.object({
  artistId: z.string().uuid(),
  action: z.enum(["set", "clear"]),
  url: z.string().url().max(4096).optional(),
  siteName: z.string().min(1).max(80).optional(),
});

/**
 * Sets or clears an artist link directly. Uses the existing extractArtistId
 * and setArtistLink/clearArtistLink helpers.
 *
 * @param request - The authenticated request with a JSON body.
 * @returns Success with the resolved platform, or an error response.
 */
export async function postDirectEditLinkHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "error", error: "Invalid request body" },
      { status: 400, headers },
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { status: "error", error: "artistId and action are required" },
      { status: 400, headers },
    );

  const { artistId, action, url, siteName } = parsed.data;

  if (!(await canEditArtist(auth.userId, artistId)))
    return NextResponse.json(
      { status: "error", error: "Not authorized for this artist" },
      { status: 403, headers },
    );

  try {
    if (action === "set") {
      if (!url)
        return NextResponse.json(
          { status: "error", error: "url is required for set action" },
          { status: 400, headers },
        );

      const extracted = await extractArtistId(url);
      if (!extracted?.siteName || !extracted?.id)
        return NextResponse.json(
          { status: "error", error: "This link is not supported. Try a different URL." },
          { status: 400, headers },
        );

      await setArtistLink(artistId, extracted.siteName, extracted.id);
      return NextResponse.json(
        {
          status: "ok",
          siteName: extracted.siteName,
          platformName: extracted.cardPlatformName,
        },
        { headers },
      );
    }

    // action === "clear"
    if (!siteName)
      return NextResponse.json(
        { status: "error", error: "siteName is required for clear action" },
        { status: 400, headers },
      );

    await clearArtistLink(artistId, siteName);
    return NextResponse.json({ status: "ok" }, { headers });
  } catch (error) {
    if (error instanceof ArtistLinkConflictError)
      return NextResponse.json(
        { status: "error", error: error.message, code: "CONFLICT" },
        { status: 409, headers },
      );
    console.error("[directEditLink] Error:", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}
