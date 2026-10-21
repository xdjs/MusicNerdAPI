import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { authenticateOwnAccount } from "@/lib/users/authenticateOwnAccount";
import { recordUserNamePrompt } from "@/lib/users/recordUserNamePrompt";

/**
 * POST /api/user/{id}/name-prompt: whether to show the one-time user-name prompt now.
 *
 * @param request - The request, with a Privy bearer token.
 * @param id - The account id from the path; must be the caller's.
 * @returns 200 `{ status: "ok", showPrompt }`, or 401, 403 or 503.
 */
export async function postUserNamePromptHandler(request: Request, id: string) {
  const headers = getCorsHeaders();
  try {
    const auth = await authenticateOwnAccount(request, id);
    if (auth instanceof NextResponse) return auth;
    return NextResponse.json(
      { status: "ok", showPrompt: await recordUserNamePrompt(id) },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { status: "error", error: "Could not load your user name setup." },
      { status: 503, headers },
    );
  }
}
