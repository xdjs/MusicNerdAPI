import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { canEditArtist } from "@/lib/auth/canEditArtist";
import { db } from "@/lib/db/db";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const bodySchema = z
  .object({
    artistId: z.string().uuid(),
    customImage: z.string().url().max(2048).nullable(),
  })
  .strict();

/**
 * Handles PATCH /api/artist/photo-choice: sets or clears the artist's custom
 * profile image URL.
 *
 * @param request - Authenticated request with `{ artistId, customImage }`.
 * @returns 200 with `{ status: "ok" }`, or an error response.
 */
export async function patchPhotoChoiceHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const auth = await authenticateRequest(request);
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

    const { artistId, customImage } = parsed.data;

    if (!(await canEditArtist(auth.userId, artistId))) {
      return NextResponse.json(
        { status: "error", error: "Not your artist" },
        { status: 403, headers },
      );
    }

    await db.execute(
      sql`UPDATE artists SET "customImage" = ${customImage} WHERE id = ${artistId}::uuid`,
    );

    return NextResponse.json({ status: "ok" }, { headers });
  } catch (error) {
    console.error("patchPhotoChoiceHandler error:", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}
