import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { canEditArtist } from "@/lib/auth/canEditArtist";
import { db } from "@/lib/db/db";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const uuidSchema = z.string().uuid();

/**
 * Handles GET /api/artist/photo-choice: returns the artist's custom image URL.
 *
 * @param request - Authenticated request with `?artistId=` query parameter.
 * @returns 200 with `{ status: "ok", customImage }`, or an error response.
 */
export async function getPhotoChoiceHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;

    const artistId = new URL(request.url).searchParams.get("artistId");
    if (!artistId || !uuidSchema.safeParse(artistId).success) {
      return NextResponse.json(
        { status: "error", error: "artistId must be a UUID" },
        { status: 400, headers },
      );
    }

    if (!(await canEditArtist(auth.userId, artistId))) {
      return NextResponse.json(
        { status: "error", error: "Not your artist" },
        { status: 403, headers },
      );
    }

    const rows = await db.execute(
      sql`SELECT "customImage" FROM artists WHERE id = ${artistId}::uuid`,
    );
    const row = (rows as unknown as { customImage: string | null }[])[0];

    return NextResponse.json({ status: "ok", customImage: row?.customImage ?? null }, { headers });
  } catch (error) {
    console.error("getPhotoChoiceHandler error:", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}
