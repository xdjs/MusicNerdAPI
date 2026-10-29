import { NextResponse } from "next/server";
import { getAdminUsersHandler } from "@/lib/adminUsers/getAdminUsersHandler";
import { patchAdminUsersHandler } from "@/lib/adminUsers/patchAdminUsersHandler";
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
 * Every user, or those whose wallet or username contains `search`.
 *
 * @param request - The request; an admin's Privy token and an optional `?search=`.
 * @returns 200 with `{ status, users }`, or an error.
 */
export async function GET(request: Request) {
  return getAdminUsersHandler(request);
}

/**
 * Turns one role (whitelisted, admin, hidden) on or off for the given users.
 *
 * @param request - The request; an admin's Privy token and `{ userIds, role, enabled }`.
 * @returns 200 with `{ status, updated }`, or an error.
 */
export async function PATCH(request: Request) {
  return patchAdminUsersHandler(request);
}
