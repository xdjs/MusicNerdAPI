import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getUserProfileImageHandler } from "@/lib/users/getUserProfileImageHandler";
import { postUserProfileImageHandler } from "@/lib/users/postUserProfileImageHandler";

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
 * A one-hour signed URL for the caller's profile photo, or null.
 *
 * @param request - The request: a Privy token, optionally `X-Profile-Account`.
 * @returns The handler's response.
 */
export async function GET(request: Request) {
  return getUserProfileImageHandler(request);
}

/**
 * Replaces the caller's profile photo with a re-encoded 512x512 WebP.
 *
 * @param request - Multipart form data with `file`, and a Privy token.
 * @returns The handler's response.
 */
export async function POST(request: Request) {
  return postUserProfileImageHandler(request);
}
