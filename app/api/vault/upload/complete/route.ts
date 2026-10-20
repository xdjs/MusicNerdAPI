import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postVaultUploadCompleteHandler } from "@/lib/vaultUploadComplete/postVaultUploadCompleteHandler";

export const dynamic = "force-dynamic";

/**
 * CORS preflight.
 *
 * @returns 200 with the CORS headers and no body.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * POST /api/vault/upload/complete — stub, not yet migrated.
 *
 * @param request - Authenticated request.
 * @returns 501 until vault upload complete is migrated.
 */
export async function POST(request: Request) {
  return postVaultUploadCompleteHandler(request);
}
