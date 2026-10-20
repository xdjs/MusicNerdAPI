import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth/authenticateAdmin";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { updateWhitelistedUser } from "@/lib/whitelistUser/updateWhitelistedUser";
import { validateWhitelistUserBody } from "@/lib/whitelistUser/validateWhitelistUserBody";

/**
 * Handles PUT /api/admin/whitelist-user/{id}: an admin edits a user's wallet,
 * email, name or roles.
 *
 * @param request - Body with any of `wallet`, `email`, `username`, `isAdmin`, `isWhiteListed`, `isHidden`.
 * @param id - The user id from the path.
 * @returns 200 with `{ status, message }`, 400 for bad fields or a failed update, or 401/403.
 */
export async function putWhitelistUserHandler(request: Request, id: string): Promise<NextResponse> {
  const auth = await authenticateAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const body = await validateWhitelistUserBody(request);
  if (body instanceof NextResponse) return body;
  const headers = getCorsHeaders();
  try {
    const result = await updateWhitelistedUser(id, body);
    if (result.status === "success")
      return NextResponse.json({ status: "ok", message: result.message }, { headers });
    return NextResponse.json({ status: "error", error: result.message }, { status: 400, headers });
  } catch (e) {
    console.error("[whitelist-user] PUT error", e);
    return NextResponse.json(
      { status: "error", error: "Error updating user" },
      { status: 400, headers },
    );
  }
}
