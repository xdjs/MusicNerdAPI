import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { db } from "@/lib/db/db";

export async function getBookmarksHandler(
  request: Request,
): Promise<NextResponse> {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;
  if ([...new URL(request.url).searchParams].length) {
    return NextResponse.json(
      { status: "error", error: "Unexpected query parameters" },
      { status: 400, headers: getCorsHeaders() },
    );
  }
  const rows = await db.execute(sql`
    SELECT b.artist_id AS "artistId",
           a.name      AS "artistName",
           a.custom_image AS "imageUrl",
           a.deezer
    FROM user_artist_bookmarks b
    JOIN artists a ON a.id = b.artist_id
    WHERE b.user_id = ${auth.userId}::uuid AND b.removed_at IS NULL
    ORDER BY b.position ASC, b.created_at ASC, b.artist_id ASC
  `);
  const bookmarks = (rows as Array<Record<string, unknown>>).map((r) => ({
    artistId: r.artistId,
    artistName: (r.artistName as string) ?? "Unknown Artist",
    imageUrl:
      r.imageUrl ??
      (r.deezer && /^[1-9]\d*$/.test(r.deezer as string)
        ? `https://api.deezer.com/artist/${r.deezer}/image?size=medium`
        : null),
  }));
  return NextResponse.json(
    { userId: auth.userId, bookmarks },
    { headers: { ...getCorsHeaders(), "Cache-Control": "private, no-store" } },
  );
}
