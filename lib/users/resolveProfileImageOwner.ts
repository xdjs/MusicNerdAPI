import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getUserById } from "@/lib/users/getUserById";

/**
 * Whose profile photo a request reads or writes, and the Storage folder it
 * lives in: `identity-<sha256 of the Privy id>` for a Privy account, else the
 * account id. Ownership comes only from the token, never from the request.
 *
 * @param request - The request; an optional `X-Profile-Account` header names the account the page expects.
 * @param userId - The authenticated account.
 * @returns The owner and folder, or a 401 (no row) or 409 (account changed) response.
 */
export async function resolveProfileImageOwner(request: Request, userId: string) {
  const headers = getCorsHeaders();
  const owner = await getUserById(userId);
  if (!owner)
    return NextResponse.json(
      { status: "error", error: "Account not found" },
      { status: 401, headers },
    );
  const expected = request.headers.get("X-Profile-Account");
  if (expected && expected !== owner.id)
    return NextResponse.json(
      { status: "error", error: "Your account changed. Refresh and try again." },
      { status: 409, headers },
    );
  const folder = owner.privyUserId
    ? `identity-${createHash("sha256").update(owner.privyUserId).digest("hex")}`
    : owner.id;
  return { owner: { id: owner.id, privyUserId: owner.privyUserId }, folder };
}
