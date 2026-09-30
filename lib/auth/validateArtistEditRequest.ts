import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { canEditArtist } from "@/lib/auth/canEditArtist";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const paramsSchema = z.object({ artistId: z.uuid({ error: "artistId must be a UUID" }) });

/**
 * Validates a signed-in request to change an artist: the path id is a UUID,
 * the Privy access token maps to a Music Nerd user, and that user is the
 * artist's approved claimant or an admin.
 *
 * @param request - The request, carrying `Authorization: Bearer <Privy access token>`.
 * @param id - The artist id from the path.
 * @returns `{ artistId, userId }`, or a 400, 401 or 403 with `{ status: "error", error }` and CORS headers.
 */
export async function validateArtistEditRequest(
  request: Request,
  id: string,
): Promise<{ artistId: string; userId: string } | NextResponse> {
  const headers = getCorsHeaders();
  const params = paramsSchema.safeParse({ artistId: id });
  if (!params.success)
    return NextResponse.json(
      { status: "error", error: params.error.issues[0].message },
      { status: 400, headers },
    );
  const { artistId } = params.data;
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;
  if (!(await canEditArtist(auth.userId, artistId)))
    return NextResponse.json(
      { status: "error", error: "Not your artist" },
      { status: 403, headers },
    );
  return { artistId, userId: auth.userId };
}
