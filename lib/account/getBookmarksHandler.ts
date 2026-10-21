import { NextResponse } from "next/server";
import { authenticateBookmarkRequest } from "@/lib/account/authenticateBookmarkRequest";
import { bookmarkJson } from "@/lib/account/bookmarkJson";
import { getUserBookmarks } from "@/lib/account/getUserBookmarks";

/**
 * Handles GET /api/bookmarks: the token's user's bookmarks in saved order.
 *
 * @param request - The request; a signed-in user's Privy token.
 * @returns 200 with `{ status, userId, bookmarks }`; 400, 401, 409 or 500.
 */
export async function getBookmarksHandler(request: Request): Promise<NextResponse> {
  try {
    const userId = await authenticateBookmarkRequest(request, false);
    if (userId instanceof NextResponse) return userId;
    return bookmarkJson({ status: "ok", userId, bookmarks: await getUserBookmarks(userId) });
  } catch {
    return bookmarkJson(
      { status: "error", error: "Could not load bookmarks. Please try again." },
      500,
    );
  }
}
