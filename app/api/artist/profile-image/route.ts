import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postProfileImageHandler } from "@/lib/profileImage/postProfileImageHandler";

export const dynamic = "force-dynamic";

/**
 * POST /api/artist/profile-image — uploads a profile image (stubbed).
 *
 * @param request - The incoming request.
 * @returns 501 Not Implemented.
 */
export async function POST(request: Request) {
  return postProfileImageHandler(request);
}

/**
 * CORS preflight.
 *
 * @returns 204 with CORS headers.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
