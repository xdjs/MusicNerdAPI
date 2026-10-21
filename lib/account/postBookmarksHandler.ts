import { NextResponse } from "next/server";
import { addUserBookmarks } from "@/lib/account/addUserBookmarks";
import { authenticateBookmarkRequest } from "@/lib/account/authenticateBookmarkRequest";
import { bookmarkJson } from "@/lib/account/bookmarkJson";
import { validateAddBookmarksBody } from "@/lib/account/validateAddBookmarksBody";

/**
 * Handles POST /api/bookmarks: adds artists to the token's user's bookmarks.
 *
 * @param request - The request; a signed-in user's Privy token, `X-Bookmark-Account`, and `{ artistIds, import? }`.
 * @returns 200 with `{ status, userId, bookmarks }`; 400, 401, 409 or 500.
 */
export async function postBookmarksHandler(request: Request): Promise<NextResponse> {
  try {
    const userId = await authenticateBookmarkRequest(request, true);
    if (userId instanceof NextResponse) return userId;
    const body = await validateAddBookmarksBody(request);
    if (body instanceof NextResponse) return body;
    const bookmarks = await addUserBookmarks(userId, body.artistIds, body.import);
    return bookmarkJson({ status: "ok", userId, bookmarks });
  } catch {
    return bookmarkJson(
      { status: "error", error: "Could not save bookmarks. Please try again." },
      500,
    );
  }
}
