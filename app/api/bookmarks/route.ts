import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getBookmarksHandler } from "@/lib/bookmarks/getBookmarksHandler";
import { mutateBookmarksHandler } from "@/lib/bookmarks/mutateBookmarksHandler";

export const dynamic = "force-dynamic";

/** List the authenticated user's bookmarked artists. */
export async function GET(request: Request) {
  return getBookmarksHandler(request);
}

/** Add artists to bookmarks. */
export async function POST(request: Request) {
  return mutateBookmarksHandler(request, "POST");
}

/** Reorder bookmarks and optionally remove some. */
export async function PATCH(request: Request) {
  return mutateBookmarksHandler(request, "PATCH");
}

/** Remove a single bookmark. */
export async function DELETE(request: Request) {
  return mutateBookmarksHandler(request, "DELETE");
}

/** CORS preflight. */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
