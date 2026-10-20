import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles GET /api/activity — recent platform activity as a union of
 * research, UGC, self-edit and new-artist events.
 *
 * @param request - The incoming request (reads optional `?since=` ISO date).
 * @returns 200 with an array of activity events, limited to 15.
 */
export async function getActivityHandler(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const since = url.searchParams.get("since");

  try {
    const result = since
      ? await db.execute(sql`
          SELECT * FROM (
            (SELECT 'research' AS type, mal.artist_id AS "artistId", a.name AS "artistName", NULL AS platform, mal.created_at AS "createdAt"
             FROM mcp_audit_log mal JOIN artists a ON a.id = mal.artist_id
             WHERE mal.created_at > ${since}::timestamptz ORDER BY mal.created_at DESC LIMIT 15)
            UNION ALL
            (SELECT 'ugc' AS type, u.artist_id AS "artistId", a.name AS "artistName", u.site_name AS platform, u.created_at AS "createdAt"
             FROM ugcresearch u JOIN artists a ON a.id = u.artist_id
             WHERE u.created_at > ${since}::timestamptz ORDER BY u.created_at DESC LIMIT 15)
            UNION ALL
            (SELECT 'self_edit' AS type, se.artist_id AS "artistId", a.name AS "artistName", se.site_name AS platform, se.created_at AS "createdAt"
             FROM artist_self_edits se JOIN artists a ON a.id = se.artist_id
             WHERE se.created_at > ${since}::timestamptz ORDER BY se.created_at DESC LIMIT 15)
            UNION ALL
            (SELECT 'new_artist' AS type, ar.id AS "artistId", ar.name AS "artistName", NULL AS platform, ar.created_at AS "createdAt"
             FROM artists ar WHERE ar.created_at > ${since}::timestamptz ORDER BY ar.created_at DESC LIMIT 15)
          ) activity ORDER BY "createdAt" DESC LIMIT 15
        `)
      : await db.execute(sql`
          SELECT * FROM (
            (SELECT 'research' AS type, mal.artist_id AS "artistId", a.name AS "artistName", NULL AS platform, mal.created_at AS "createdAt"
             FROM mcp_audit_log mal JOIN artists a ON a.id = mal.artist_id ORDER BY mal.created_at DESC LIMIT 15)
            UNION ALL
            (SELECT 'ugc' AS type, u.artist_id AS "artistId", a.name AS "artistName", u.site_name AS platform, u.created_at AS "createdAt"
             FROM ugcresearch u JOIN artists a ON a.id = u.artist_id ORDER BY u.created_at DESC LIMIT 15)
            UNION ALL
            (SELECT 'self_edit' AS type, se.artist_id AS "artistId", a.name AS "artistName", se.site_name AS platform, se.created_at AS "createdAt"
             FROM artist_self_edits se JOIN artists a ON a.id = se.artist_id ORDER BY se.created_at DESC LIMIT 15)
            UNION ALL
            (SELECT 'new_artist' AS type, ar.id AS "artistId", ar.name AS "artistName", NULL AS platform, ar.created_at AS "createdAt"
             FROM artists ar ORDER BY ar.created_at DESC LIMIT 15)
          ) activity ORDER BY "createdAt" DESC LIMIT 15
        `);

    return NextResponse.json([...result], { status: 200, headers: getCorsHeaders() });
  } catch {
    return NextResponse.json(
      { status: "error", error: "Failed to fetch activity" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
