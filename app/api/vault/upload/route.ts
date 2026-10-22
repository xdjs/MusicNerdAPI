import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postUploadHandler } from "@/lib/vaultUpload/postUploadHandler";

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
 * Uploads a file to an artist's vault in one request: the file travels
 * through the API, is checked, stored, saved as an approved source, and a
 * Lore refresh is queued. The site uses the two-step sign and complete
 * routes instead.
 *
 * @param request - The request; a claimant or admin Privy token, `multipart/form-data` with `file` and `artistId`.
 * @returns 200 with `{ status, success, source, warning? }`, or an error.
 */
export async function POST(request: Request) {
  return postUploadHandler(request);
}
