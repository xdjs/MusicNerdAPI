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
    imageUrl: z.string().url().max(2048),
    y: z.number().min(0).max(100),
  })
  .strict();

/**
 * Handles PATCH /api/artist/header-position: updates the header image position
 * and URL for an artist. The caller must be the claimant or an admin.
 *
 * @param request - The authenticated request carrying the position payload.
 * @returns 200 on success, or 400/401/403.
 */
export async function patchHeaderPositionHandler(request: Request) {
  const headers = getCorsHeaders();

  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400, headers });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { status: "error", error: parsed.error.issues[0].message },
      { status: 400, headers },
    );
  }

  const { artistId, imageUrl, y } = parsed.data;

  if (!(await canEditArtist(auth.userId, artistId))) {
    return NextResponse.json(
      { status: "error", error: "Not your artist" },
      { status: 403, headers },
    );
  }

  await db.execute(
    sql`UPDATE artists SET "headerImagePosition" = ${y}, "headerImageUrl" = ${imageUrl} WHERE id = ${artistId}::uuid`,
  );

  return NextResponse.json({ status: "ok" }, { headers });
}
