import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { validateArtistEditRequest } from "@/lib/auth/validateArtistEditRequest";
import { db } from "@/lib/db/db";
import { artists } from "@/lib/db/schema";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const bodySchema = z
  .object({
    bio: z.string().max(15000),
  })
  .strict();

/**
 * Handles PUT /api/artistBio/[id]: updates the artist's bio text.
 *
 * @param request - Authenticated request with `{ bio }`.
 * @param id - The artist id from the path.
 * @returns 200 with `{ status: "ok" }`, or an error response.
 */
export async function putArtistBioHandler(request: Request, id: string): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const auth = await validateArtistEditRequest(request, id);
    if (auth instanceof NextResponse) return auth;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { status: "error", error: "Invalid JSON" },
        { status: 400, headers },
      );
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { status: "error", error: parsed.error.issues[0].message },
        { status: 400, headers },
      );
    }

    await db.update(artists).set({ bio: parsed.data.bio }).where(eq(artists.id, auth.artistId));

    return NextResponse.json({ status: "ok" }, { headers });
  } catch (error) {
    console.error("putArtistBioHandler error:", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}
