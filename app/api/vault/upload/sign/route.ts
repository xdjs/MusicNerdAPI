import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postVaultUploadSignHandler } from "@/lib/vaultUploadSign/postVaultUploadSignHandler";

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
 * POST /api/vault/upload/sign — stub, not yet migrated.
 *
 * @param request - Authenticated request.
 * @returns 501 until vault upload signing is migrated.
 */
export async function POST(request: Request) {
  return postVaultUploadSignHandler(request);
}
