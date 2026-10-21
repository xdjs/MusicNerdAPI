import { NextResponse } from "next/server";
import { deleteBookmarksHandler } from "@/lib/account/deleteBookmarksHandler";
import { getBookmarksHandler } from "@/lib/account/getBookmarksHandler";
import { patchBookmarksHandler } from "@/lib/account/patchBookmarksHandler";
import { postBookmarksHandler } from "@/lib/account/postBookmarksHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const dynamic = "force-dynamic";

/**
 * CORS preflight.
 *
 * @returns 200 with the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * The signed-in user's bookmarks in saved order.
 *
 * @param request - The request; a signed-in user's Privy token.
 * @returns 200 with `{ status, userId, bookmarks }`, or an error.
 */
export async function GET(request: Request) {
  return getBookmarksHandler(request);
}

/**
 * Adds artists to the signed-in user's bookmarks.
 *
 * @param request - The request; a Privy token, `X-Bookmark-Account`, and `{ artistIds, import? }`.
 * @returns 200 with `{ status, userId, bookmarks }`, or an error.
 */
export async function POST(request: Request) {
  return postBookmarksHandler(request);
}

/**
 * Removes and reorders the signed-in user's bookmarks.
 *
 * @param request - The request; a Privy token, `X-Bookmark-Account`, and `{ orderedArtistIds, removedArtistIds }`.
 * @returns 200 with `{ status, userId, bookmarks }`, or an error.
 */
export async function PATCH(request: Request) {
  return patchBookmarksHandler(request);
}

/**
 * Removes one artist from the signed-in user's bookmarks.
 *
 * @param request - The request; a Privy token, `X-Bookmark-Account`, and `{ artistId }`.
 * @returns 200 with `{ status, userId, bookmarks }`, or an error.
 */
export async function DELETE(request: Request) {
  return deleteBookmarksHandler(request);
}
