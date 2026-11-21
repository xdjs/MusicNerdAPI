import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * An error in the standard OAuth shape (RFC 6749 section 5.2), which
 * registration, authorization and the token endpoint use instead of
 * `{ status, error }`.
 *
 * @param error - The OAuth error code, like `invalid_grant`.
 * @param description - A human-readable explanation.
 * @param status - The HTTP status, 400 by default.
 * @returns The response, never cached.
 */
export function oauthErrorResponse(error: string, description: string, status = 400) {
  return NextResponse.json(
    { error, error_description: description },
    { status, headers: { ...getCorsHeaders(), "Cache-Control": "no-store" } },
  );
}
