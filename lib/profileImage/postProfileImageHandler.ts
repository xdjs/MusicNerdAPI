import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles POST /api/artist/profile-image: uploads a profile image.
 * Stubbed: requires Supabase Storage integration.
 *
 * @param _request - The request (unused).
 * @returns 501 Not Implemented.
 */
export async function postProfileImageHandler(_request: Request): Promise<NextResponse> {
  return NextResponse.json(
    { status: "error", error: "Not implemented: requires Supabase Storage" },
    { status: 501, headers: getCorsHeaders() },
  );
}
