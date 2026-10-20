import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getUserProfileImageHandler } from "@/lib/user/getUserProfileImageHandler";
import { postUserProfileImageHandler } from "@/lib/user/postUserProfileImageHandler";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/profile-image — signed URL for the user's profile image.
 *
 * @param request - The incoming request.
 * @returns 200 with `{ url }`.
 */
export async function GET(request: Request) {
  return getUserProfileImageHandler(request);
}

/**
 * POST /api/user/profile-image — upload a new profile image.
 *
 * @param request - The incoming request with image data.
 * @returns 200 on success.
 */
export async function POST(request: Request) {
  return postUserProfileImageHandler(request);
}

/**
 * CORS preflight.
 *
 * @returns 204 with CORS headers.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
