import { NextResponse } from "next/server";
import { authenticateBookmarkRequest } from "@/lib/account/authenticateBookmarkRequest";
import { bookmarkJson } from "@/lib/account/bookmarkJson";
import { editUserBookmarks } from "@/lib/account/editUserBookmarks";
import { validateEditBookmarksBody } from "@/lib/account/validateEditBookmarksBody";

/**
 * Handles PATCH /api/bookmarks: removes and reorders the token's user's bookmarks.
 *
 * @param request - The request; a signed-in user's Privy token, `X-Bookmark-Account`, and `{ orderedArtistIds, removedArtistIds }`.
 * @returns 200 with `{ status, userId, bookmarks }`; 400, 401, 409 or 500.
 */
export async function patchBookmarksHandler(request: Request): Promise<NextResponse> {
  try {
    const userId = await authenticateBookmarkRequest(request, true);
    if (userId instanceof NextResponse) return userId;
    const body = await validateEditBookmarksBody(request);
    if (body instanceof NextResponse) return body;
    const bookmarks = await editUserBookmarks(userId, body.orderedArtistIds, body.removedArtistIds);
    return bookmarkJson({ status: "ok", userId, bookmarks });
  } catch {
    return bookmarkJson(
      { status: "error", error: "Could not save bookmarks. Please try again." },
      500,
    );
  }
}
