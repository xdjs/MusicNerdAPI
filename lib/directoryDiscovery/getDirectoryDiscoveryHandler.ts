import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { db } from "@/lib/db/db";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles GET /api/artist/{id}/directory-discovery: returns the discovery state
 * for a recently-added artist. Requires a signed-in user who is the creator or
 * an admin.
 *
 * @param request - The authenticated request.
 * @param id - The artist id from the path.
 * @returns 200 with `{ status, state }`, or 400/401/404/503.
 */
export async function getDirectoryDiscoveryHandler(request: Request, id: string) {
  const headers = getCorsHeaders();

  const idResult = z.string().uuid().safeParse(id);
  if (!idResult.success) {
    return NextResponse.json(
      { status: "error", error: "Invalid artist id" },
      { status: 400, headers },
    );
  }

  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await db.execute(sql`
      SELECT CASE
        WHEN EXISTS(SELECT 1 FROM artist_claims c WHERE c.artist_id = a.id) THEN 'stopped'
        WHEN directory_jobs.active OR directory_jobs.awaiting_handoff THEN 'active'
        WHEN directory_jobs.unfinished THEN 'failed'
        ELSE 'complete'
      END AS state
      FROM artists a
      JOIN users viewer ON viewer.id = ${auth.userId}::uuid
      JOIN artist_activity_events creation ON creation.artist_id = a.id
        AND creation.action = 'directory_add' AND creation.trigger = 'directory_add'
        AND creation.actor_kind = 'user' AND creation.actor_user_id = a.added_by
      JOIN artist_research_jobs parent ON parent.artist_id = a.id AND parent.activity_id = creation.id
        AND parent.kind = 'source_search' AND parent.state->>'purpose' = 'directory_preparation'
        AND parent.state->>'creationActivityId' = creation.id::text
      CROSS JOIN LATERAL (
        SELECT
          bool_or(j.status IN ('pending','running','queued') AND j.attempts < 4) AS active,
          bool_or(j.status <> 'done') AS unfinished,
          bool_or(j.kind = 'social_ingest' AND j.status = 'done' AND NOT EXISTS (
            SELECT 1 FROM artist_research_jobs child WHERE child.artist_id = a.id
              AND child.kind = 'caption_extract'
              AND child.state->>'directoryActivityId' = creation.id::text
          )) AS awaiting_handoff
        FROM artist_research_jobs j
        LEFT JOIN artist_activity_events activity ON activity.id = j.activity_id
        WHERE j.artist_id = a.id AND j.kind IN ('source_search','lore_refresh','social_ingest','caption_extract','source_extract','spotify_match')
          AND (j.activity_id = creation.id OR activity.parent_activity_id = creation.id
            OR j.state->>'directoryActivityId' = creation.id::text
            OR j.state->>'creationActivityId' = creation.id::text)
      ) directory_jobs
      WHERE a.id = ${id}::uuid AND a.created_at > now() - interval '24 hours'
        AND a.created_at <= now() AND (viewer.is_admin OR creation.actor_user_id = viewer.id)
      LIMIT 1
    `);

    const rows = result as unknown as { state: string }[];
    if (!rows.length) {
      return NextResponse.json(
        { status: "error", error: "Discovery is unavailable" },
        { status: 404, headers },
      );
    }

    return NextResponse.json({ status: "ok", state: rows[0].state }, { headers });
  } catch {
    return NextResponse.json(
      { status: "error", error: "Discovery could not be checked" },
      { status: 503, headers },
    );
  }
}
