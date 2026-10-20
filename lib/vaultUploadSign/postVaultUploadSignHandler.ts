import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles POST /api/vault/upload/sign — stub, not yet migrated.
 *
 * @param request - Authenticated request.
 * @returns 501 with an error message.
 */
export async function postVaultUploadSignHandler(request: Request): Promise<NextResponse> {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json(
    { status: "error", error: "Vault upload not yet migrated to API" },
    { status: 501, headers: getCorsHeaders() },
  );
}
