import { NextResponse } from "next/server";
import { postProfileImageHandler } from "@/lib/artistImages/postProfileImageHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const dynamic = "force-dynamic";

/**
 * CORS preflight.
 *
 * @returns 200 with the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * Uploads a PNG, JPEG or WebP as the artist's profile photo.
 *
 * @param request - The request; a claimant or admin Privy token, a multipart form with `file` and `artistId`.
 * @returns 200 with `{ status, success, imagePath }`, or an error.
 */
export async function POST(request: Request) {
  return postProfileImageHandler(request);
}
