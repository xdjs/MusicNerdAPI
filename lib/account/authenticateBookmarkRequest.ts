import { NextResponse } from "next/server";
import { bookmarkJson } from "@/lib/account/bookmarkJson";
import { BOOKMARK_CACHE_HEADERS } from "@/lib/account/const";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";

/**
 * Who owns the bookmarks: the token's user. A write must also assert that
 * account in `X-Bookmark-Account`, and any request that does must match, so a
 * page left open across a sign-out and sign-in cannot touch another account's
 * list. Query parameters are refused: ownership never comes from the URL.
 *
 * @param request - The request.
 * @param mutation - True for a write.
 * @returns The user id, or a 400, 401 or 409 response.
 */
export async function authenticateBookmarkRequest(
  request: Request,
  mutation: boolean,
): Promise<string | NextResponse> {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) {
    auth.headers.set("Cache-Control", BOOKMARK_CACHE_HEADERS["Cache-Control"]);
    auth.headers.set("Vary", BOOKMARK_CACHE_HEADERS.Vary);
    return auth;
  }
  const userId = auth.userId;
  const expectedAccount = request.headers.get("X-Bookmark-Account");
  if ((mutation && !expectedAccount) || (expectedAccount && expectedAccount !== userId)) {
    return bookmarkJson(
      { status: "error", error: "Account changed. Refresh before updating bookmarks." },
      409,
    );
  }
  if ([...new URL(request.url).searchParams].length)
    return bookmarkJson({ status: "error", error: "Unexpected query parameters" }, 400);
  return userId;
}
