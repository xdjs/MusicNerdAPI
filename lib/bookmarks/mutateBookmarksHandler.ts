import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { db } from "@/lib/db/db";
import { getBookmarksHandler } from "@/lib/bookmarks/getBookmarksHandler";

const uuid = z
  .string()
  .uuid()
  .transform(v => v.toLowerCase());
const ids = z.array(uuid).max(500);
const addBody = z.object({ artistIds: ids, import: z.boolean().optional() }).strict();
const removeBody = z.object({ artistId: uuid }).strict();
const editBody = z.object({ orderedArtistIds: ids, removedArtistIds: ids }).strict();

export async function mutateBookmarksHandler(
  request: Request,
  method: "POST" | "PATCH" | "DELETE",
): Promise<NextResponse> {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  const expectedAccount = request.headers.get("X-Bookmark-Account");
  if (
    (!expectedAccount && method !== "DELETE") ||
    (expectedAccount && expectedAccount !== auth.userId)
  ) {
    if (!expectedAccount && method !== "DELETE") {
      /* mutation requires X-Bookmark-Account except DELETE which uses body */
    }
    if (expectedAccount && expectedAccount !== auth.userId) {
      return NextResponse.json(
        { status: "error", error: "Account changed. Refresh before updating bookmarks." },
        { status: 409, headers: getCorsHeaders() },
      );
    }
  }

  if ([...new URL(request.url).searchParams].length) {
    return NextResponse.json(
      { status: "error", error: "Unexpected query parameters" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "error", error: "Invalid JSON body" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const schema = method === "POST" ? addBody : method === "DELETE" ? removeBody : editBody;
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { status: "error", error: "Invalid bookmark request" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  if (method === "POST") {
    const { artistIds, import: importing } = addBody.parse(body);
    await db.execute(sql`SELECT id FROM users WHERE id = ${auth.userId}::uuid FOR UPDATE`);
    for (const artistId of artistIds) {
      if (importing) {
        await db.execute(sql`
          INSERT INTO user_artist_bookmarks (user_id, artist_id, position)
          SELECT ${auth.userId}::uuid, ${artistId}::uuid, 0
          WHERE EXISTS (SELECT 1 FROM artists WHERE id = ${artistId}::uuid)
          ON CONFLICT (user_id, artist_id) DO NOTHING
        `);
      } else {
        await db.execute(sql`
          INSERT INTO user_artist_bookmarks (user_id, artist_id, position)
          SELECT ${auth.userId}::uuid, ${artistId}::uuid, 0
          WHERE EXISTS (SELECT 1 FROM artists WHERE id = ${artistId}::uuid)
          ON CONFLICT (user_id, artist_id) DO UPDATE SET removed_at = NULL
        `);
      }
    }
  } else if (method === "DELETE") {
    const { artistId } = removeBody.parse(body);
    await db.execute(sql`
      UPDATE user_artist_bookmarks SET removed_at = now()
      WHERE user_id = ${auth.userId}::uuid AND artist_id = ${artistId}::uuid
    `);
  } else {
    const { orderedArtistIds, removedArtistIds } = editBody.parse(body);
    await db.execute(sql`SELECT id FROM users WHERE id = ${auth.userId}::uuid FOR UPDATE`);
    if (removedArtistIds.length) {
      for (const artistId of removedArtistIds) {
        await db.execute(sql`
          UPDATE user_artist_bookmarks SET removed_at = now()
          WHERE user_id = ${auth.userId}::uuid AND artist_id = ${artistId}::uuid
        `);
      }
    }
    for (let i = 0; i < orderedArtistIds.length; i++) {
      await db.execute(sql`
        UPDATE user_artist_bookmarks SET position = ${i}
        WHERE user_id = ${auth.userId}::uuid AND artist_id = ${orderedArtistIds[i]}::uuid AND removed_at IS NULL
      `);
    }
  }

  return getBookmarksHandler(request);
}
