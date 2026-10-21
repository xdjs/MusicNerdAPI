import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { authenticateOwnAccount } from "@/lib/users/authenticateOwnAccount";
import { setUserName } from "@/lib/users/setUserName";
import { validateUpdateUserNameBody } from "@/lib/users/validateUpdateUserNameBody";
import { validateUserName } from "@/lib/users/validateUserName";

/**
 * PATCH /api/user/{id}: saves the caller's chosen user name.
 *
 * @param request - The request: a Privy bearer token and `{ username }`.
 * @param id - The account id from the path; must be the caller's.
 * @returns 200 `{ status: "ok", message }`, or 400, 401, 403, 409 or 500.
 */
export async function patchUserHandler(request: Request, id: string) {
  const headers = getCorsHeaders();
  try {
    const auth = await authenticateOwnAccount(request, id);
    if (auth instanceof NextResponse) return auth;
    const body = await validateUpdateUserNameBody(request);
    if (body instanceof NextResponse) return body;
    const { username } = body;
    const trimmed = typeof username === "string" ? username.trim() : "";
    const invalid = validateUserName(username);
    if (invalid)
      return NextResponse.json({ status: "error", error: invalid }, { status: 400, headers });
    await setUserName(id, trimmed);
    return NextResponse.json({ status: "ok", message: "User name updated" }, { headers });
  } catch (error) {
    if (error instanceof Error && error.message.includes("email or wallet"))
      return NextResponse.json({ status: "error", error: error.message }, { status: 400, headers });
    if (error instanceof Error && error.message.includes("already taken"))
      return NextResponse.json({ status: "error", error: error.message }, { status: 409, headers });
    console.error("[API] update username error", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}
