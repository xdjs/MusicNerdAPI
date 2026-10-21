import { NextResponse } from "next/server";
import { authenticateBookmarkRequest } from "@/lib/account/authenticateBookmarkRequest";
import { bookmarkJson } from "@/lib/account/bookmarkJson";
import { removeUserBookmark } from "@/lib/account/removeUserBookmark";
import { validateRemoveBookmarkBody } from "@/lib/account/validateRemoveBookmarkBody";

/**
 * Handles DELETE /api/bookmarks: removes one artist from the token's user's bookmarks.
 *
 * @param request - The request; a signed-in user's Privy token, `X-Bookmark-Account`, and `{ artistId }`.
 * @returns 200 with `{ status, userId, bookmarks }`; 400, 401, 409 or 500.
 */
export async function deleteBookmarksHandler(request: Request): Promise<NextResponse> {
  try {
    const userId = await authenticateBookmarkRequest(request, true);
    if (userId instanceof NextResponse) return userId;
    const body = await validateRemoveBookmarkBody(request);
    if (body instanceof NextResponse) return body;
    const bookmarks = await removeUserBookmark(userId, body.artistId);
    return bookmarkJson({ status: "ok", userId, bookmarks });
  } catch {
    return bookmarkJson(
      { status: "error", error: "Could not save bookmarks. Please try again." },
      500,
    );
  }
}
