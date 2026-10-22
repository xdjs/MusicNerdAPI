import { NextResponse } from "next/server";
import { getPhotoChoiceHandler } from "@/lib/artistImages/getPhotoChoiceHandler";
import { patchPhotoChoiceHandler } from "@/lib/artistImages/patchPhotoChoiceHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * CORS preflight.
 *
 * @returns 200 with the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * The provider photos an artist can pick as their profile photo.
 *
 * @param request - The request; a claimant or admin Privy token, `artistId` in the query.
 * @returns 200 with `{ status, expectedCustomImage, options }`, or an error.
 */
export async function GET(request: Request) {
  return getPhotoChoiceHandler(request);
}

/**
 * Sets the artist's profile photo to one of the provider photos.
 *
 * @param request - The request; a claimant or admin Privy token, the choice as JSON.
 * @returns 200 with `{ status, success, imagePath, position }`, or an error.
 */
export async function PATCH(request: Request) {
  return patchPhotoChoiceHandler(request);
}
