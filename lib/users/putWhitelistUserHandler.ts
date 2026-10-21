import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth/authenticateAdmin";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { updateWhitelistedUser } from "@/lib/users/updateWhitelistedUser";
import { validateUserId } from "@/lib/users/validateUserId";
import { validateWhitelistUserBody } from "@/lib/users/validateWhitelistUserBody";

/**
 * Handles PUT /api/admin/whitelist-user/{id}: changes the fields sent.
 *
 * @param request - The request; an admin's Privy token and the fields to change.
 * @param id - The user id from the path.
 * @returns 200 with `{ status, message }`; 400, 401, 403 or 500 with `{ status: "error", error }`.
 */
export async function putWhitelistUserHandler(request: Request, id: string): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const auth = await authenticateAdmin(request);
    if (auth instanceof NextResponse) return auth;
    const userId = validateUserId(id);
    if (userId instanceof NextResponse) return userId;
    const body = await validateWhitelistUserBody(request);
    if (body instanceof NextResponse) return body;

    const result = await updateWhitelistedUser(userId, body);
    if (result.status === "success")
      return NextResponse.json({ status: "ok", message: result.message }, { status: 200, headers });
    return NextResponse.json({ status: "error", error: result.message }, { status: 400, headers });
  } catch (e) {
    console.error("[whitelist-user] PUT error", e);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}
