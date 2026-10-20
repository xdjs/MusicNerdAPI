import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getBookmarksHandler } from "@/lib/bookmarks/getBookmarksHandler";
import { mutateBookmarksHandler } from "@/lib/bookmarks/mutateBookmarksHandler";

export const dynamic = "force-dynamic";

/**
 * GET /api/bookmarks — list bookmarked artists.
 *
 * @param request - The incoming request.
 * @returns 200 with the user's bookmarks.
 */
export async function GET(request: Request) {
  return getBookmarksHandler(request);
}

/**
 * POST /api/bookmarks — add artists to bookmarks.
 *
 * @param request - The incoming request with artist IDs.
 * @returns 200 on success.
 */
export async function POST(request: Request) {
  return mutateBookmarksHandler(request, "POST");
}

/**
 * PATCH /api/bookmarks — reorder bookmarks and optionally remove some.
 *
 * @param request - The incoming request with new ordering.
 * @returns 200 on success.
 */
export async function PATCH(request: Request) {
  return mutateBookmarksHandler(request, "PATCH");
}

/**
 * DELETE /api/bookmarks — remove a single bookmark.
 *
 * @param request - The incoming request with bookmark ID.
 * @returns 200 on success.
 */
export async function DELETE(request: Request) {
  return mutateBookmarksHandler(request, "DELETE");
}

/**
 * CORS preflight.
 *
 * @returns 204 with CORS headers.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
