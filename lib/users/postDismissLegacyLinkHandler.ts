import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { authenticateOwnAccount } from "@/lib/users/authenticateOwnAccount";
import { dismissLegacyLink } from "@/lib/users/dismissLegacyLink";

/**
 * POST /api/user/{id}/dismiss-legacy-link: stops the prompt to link an older
 * wallet-based account.
 *
 * @param request - The request, with a Privy bearer token.
 * @param id - The account id from the path; must be the caller's.
 * @returns 200 `{ status: "ok" }`, or 401, 403 or 500.
 */
export async function postDismissLegacyLinkHandler(request: Request, id: string) {
  const headers = getCorsHeaders();
  try {
    const auth = await authenticateOwnAccount(request, id);
    if (auth instanceof NextResponse) return auth;
    await dismissLegacyLink(id);
    return NextResponse.json({ status: "ok" }, { headers });
  } catch (error) {
    console.error("[API] dismiss legacy link error", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}
