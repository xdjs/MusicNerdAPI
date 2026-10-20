import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getSpotifyHeaders } from "@/lib/spotify/getSpotifyHeaders";
import { fetchSpotifyArtist } from "@/lib/spotify/fetchSpotifyArtist";
import { fetchSpotifyArtists } from "@/lib/spotify/fetchSpotifyArtists";
import { SpotifyDeferredError } from "@/lib/spotify/SpotifyDeferredError";

export const dynamic = "force-dynamic";

/**
 * CORS preflight for the Spotify data endpoint.
 *
 * @returns Empty 200 with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * Fetch Spotify artist data by single ID or comma-separated IDs.
 *
 * @param req - GET with `?spotifyId=` or `?spotifyIds=id1,id2`.
 * @returns Artist data or an error.
 */
export async function GET(req: Request) {
  const headers = getCorsHeaders();
  const { searchParams } = new URL(req.url);
  const spotifyId = searchParams.get("spotifyId")?.trim();
  const spotifyIds = searchParams
    .get("spotifyIds")
    ?.split(",")
    .map(id => id.trim())
    .filter(Boolean);

  // Batch query via query params
  if (spotifyIds && spotifyIds.length > 0) {
    if (spotifyIds.length > 50) {
      return NextResponse.json(
        { error: "Maximum 50 IDs allowed per request" },
        { status: 400, headers },
      );
    }
    try {
      const auth = await getSpotifyHeaders();
      const artists = await fetchSpotifyArtists(spotifyIds, auth);
      return NextResponse.json({ data: artists }, { headers });
    } catch {
      return NextResponse.json({ error: "Failed to fetch artist data" }, { status: 502, headers });
    }
  }

  // Single query
  if (!spotifyId) {
    return NextResponse.json(
      { error: "spotifyId or spotifyIds is required" },
      { status: 400, headers },
    );
  }

  try {
    const auth = await getSpotifyHeaders();
    const { data, error } = await fetchSpotifyArtist(spotifyId, auth);
    if (error)
      return NextResponse.json(
        { error },
        { status: 502, headers: { ...headers, "Cache-Control": "no-store" } },
      );
    return NextResponse.json({ data }, { headers });
  } catch (error) {
    if (error instanceof SpotifyDeferredError) {
      return NextResponse.json(
        { error: "Spotify is temporarily rate limited. Please try again later." },
        {
          status: 503,
          headers: {
            ...headers,
            "Cache-Control": "no-store",
            "Retry-After": String(Math.max(1, Math.ceil((error.retryAtMs - Date.now()) / 1000))),
          },
        },
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch artist data" },
      { status: 502, headers: { ...headers, "Cache-Control": "no-store" } },
    );
  }
}

/**
 * Batch-fetch Spotify artist data via POST.
 *
 * @param req - POST body with `{ spotifyIds: string[] }`.
 * @returns Array of artist objects or an error.
 */
export async function POST(req: Request) {
  const headers = getCorsHeaders();
  try {
    const body = await req.json();
    if (!Array.isArray(body?.spotifyIds) || body.spotifyIds.length === 0) {
      return NextResponse.json({ error: "spotifyIds array is required" }, { status: 400, headers });
    }

    const cleaned = [
      ...new Set((body.spotifyIds as string[]).map(id => id.trim()).filter(Boolean)),
    ];
    if (cleaned.length === 0) {
      return NextResponse.json(
        { error: "No valid Spotify IDs provided" },
        { status: 400, headers },
      );
    }
    if (cleaned.length > 50) {
      return NextResponse.json(
        { error: "Maximum 50 IDs allowed per request" },
        { status: 400, headers },
      );
    }

    const timeoutPromise = new Promise<NextResponse>((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), 12_000),
    );

    const fetchOperation = async (): Promise<NextResponse> => {
      const auth = await getSpotifyHeaders();
      const artists = await fetchSpotifyArtists(cleaned, auth);
      return NextResponse.json({ data: artists }, { headers });
    };

    return await Promise.race([fetchOperation(), timeoutPromise]);
  } catch (error) {
    if (error instanceof Error && error.message === "Request timeout") {
      return NextResponse.json({ error: "Request timed out" }, { status: 408, headers });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers });
  }
}
