import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles POST /api/askArtist — ask a question about an artist.
 * Stub: the orchestration is not yet migrated from MusicNerdWeb.
 *
 * @param request - Authenticated POST with `{ artistId, question }`.
 * @returns 501 until the orchestration is migrated.
 */
export async function postAskArtistHandler(request: Request): Promise<NextResponse> {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "error", error: "Invalid JSON body" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { status: "error", error: "Request body must be an object" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const { artistId, question } = body as Record<string, unknown>;
  if (typeof artistId !== "string" || !artistId) {
    return NextResponse.json(
      { status: "error", error: "artistId is required" },
      { status: 400, headers: getCorsHeaders() },
    );
  }
  if (typeof question !== "string" || !question) {
    return NextResponse.json(
      { status: "error", error: "question is required" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return NextResponse.json(
    { status: "error", error: "askArtist orchestration not yet migrated to API" },
    { status: 501, headers: getCorsHeaders() },
  );
}
