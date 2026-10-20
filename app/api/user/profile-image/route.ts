import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getUserProfileImageHandler } from "@/lib/user/getUserProfileImageHandler";
import { postUserProfileImageHandler } from "@/lib/user/postUserProfileImageHandler";

export const dynamic = "force-dynamic";

/** Get the signed URL for the authenticated user's profile image. */
export async function GET(request: Request) {
  return getUserProfileImageHandler(request);
}

/** Upload a new profile image for the authenticated user. */
export async function POST(request: Request) {
  return postUserProfileImageHandler(request);
}

/** CORS preflight. */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
