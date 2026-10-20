import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getArtistById } from "@/lib/artists/getArtistById";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const idSchema = z.string().uuid();

/**
 * Handles GET /api/artistBio/[id]: returns the artist's bio text.
 *
 * @param request - Authenticated request.
 * @param id - The artist id from the path.
 * @returns 200 with `{ status: "ok", bio }`, or an error response.
 */
export async function getArtistBioHandler(request: Request, id: string): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    if (!idSchema.safeParse(id).success) {
      return NextResponse.json(
        { status: "error", error: "id must be a UUID" },
        { status: 400, headers },
      );
    }

    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;

    const artist = await getArtistById(id);
    if (!artist) {
      return NextResponse.json({ status: "error", error: "Artist not found" }, { status: 404, headers });
    }

    return NextResponse.json({ status: "ok", bio: artist.bio ?? null }, { headers });
  } catch (error) {
    console.error("getArtistBioHandler error:", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}
