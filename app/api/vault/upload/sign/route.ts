import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postSignUploadHandler } from "@/lib/vaultUpload/postSignUploadHandler";

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
 * Signs an upload to an artist's vault: checks the file's name, type and
 * size, and returns a signed storage URL to `PUT` the file to and a
 * 15-minute ticket for the complete route.
 *
 * @param request - The request; a claimant or admin Privy token, JSON `{ artistId, name, type, size }`.
 * @returns 200 with `{ status, signedUrl, contentType, ticket }`, or an error.
 */
export async function POST(request: Request) {
  return postSignUploadHandler(request);
}
