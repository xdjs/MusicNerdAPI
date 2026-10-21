import { NextResponse } from "next/server";
import { getRecentActivity } from "@/lib/activityFeed/getRecentActivity";
import { validateActivityQuery } from "@/lib/activityFeed/validateActivityQuery";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * GET /api/activity: the public activity feed, newest first. Public.
 * MusicNerdWeb returned the bare array; here it is `events`.
 *
 * @param request - The request; `since` optional.
 * @returns 200 with `{ status, events }`, 400 for a bad `since`, or 500.
 */
export async function getActivityHandler(request: Request) {
  const headers = getCorsHeaders();
  try {
    const query = validateActivityQuery(request);
    if (query instanceof NextResponse) return query;
    const events = await getRecentActivity(query.since);
    return NextResponse.json(
      {
        status: "ok",
        events: events.map(e => ({
          type: e.type,
          artistId: e.artist_id,
          artistName: e.artist_name,
          platform: e.platform?.replace("mapping:", "") ?? null,
          createdAt: e.created_at,
        })),
      },
      { headers },
    );
  } catch (error) {
    console.error("[activity] GET error:", error);
    return NextResponse.json(
      { status: "error", error: "Failed to fetch activity" },
      { status: 500, headers },
    );
  }
}
