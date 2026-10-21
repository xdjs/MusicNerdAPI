import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { authenticateOwnAccount } from "@/lib/users/authenticateOwnAccount";
import { getUserById } from "@/lib/users/getUserById";

/**
 * GET /api/user/{id}: the caller's own user row.
 *
 * @param request - The request, with a Privy bearer token.
 * @param id - The account id from the path; must be the caller's.
 * @returns 200 with the row and `status: "ok"`, or 401, 403, 404 or 500.
 */
export async function getUserHandler(request: Request, id: string) {
  const headers = getCorsHeaders();
  try {
    const auth = await authenticateOwnAccount(request, id);
    if (auth instanceof NextResponse) return auth;
    const user = await getUserById(id);
    if (!user)
      return NextResponse.json(
        { status: "error", error: "User not found" },
        { status: 404, headers },
      );
    return NextResponse.json({ status: "ok", ...user }, { headers });
  } catch (error) {
    console.error("[API] get user error", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}
