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
    section: z.string().min(1).max(100),
    order: z.array(z.string().max(100)).max(50),
  })
  .strict();

/**
 * Handles PUT /api/artist/link-order: upserts the display order of links in a
 * section for an artist.
 *
 * @param request - Authenticated request with `{ artistId, section, order }`.
 * @returns 200 with `{ status: "ok" }`, or an error response.
 */
export async function putLinkOrderHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
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

    const { artistId, section, order } = parsed.data;

    if (!(await canEditArtist(auth.userId, artistId))) {
      return NextResponse.json({ status: "error", error: "Not your artist" }, { status: 403, headers });
    }

    await db.execute(
      sql`INSERT INTO artist_link_order (artist_id, section, "order")
          VALUES (${artistId}::uuid, ${section}, ${JSON.stringify(order)}::jsonb)
          ON CONFLICT (artist_id, section) DO UPDATE SET "order" = EXCLUDED."order"`,
    );

    return NextResponse.json({ status: "ok" }, { headers });
  } catch (error) {
    console.error("putLinkOrderHandler error:", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}
