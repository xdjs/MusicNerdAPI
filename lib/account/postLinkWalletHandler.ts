import { NextResponse } from "next/server";
import { getUserById } from "@/lib/users/getUserById";
import { withDbRetry } from "@/lib/db/withDbRetry";
import { getUserByWallet } from "@/lib/account/getUserByWallet";
import { linkWalletToUser } from "@/lib/account/linkWalletToUser";
import { mergeAccounts } from "@/lib/account/mergeAccounts";
import { validateLinkWalletBody } from "@/lib/account/validateLinkWalletBody";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getPrivyUser } from "@/lib/auth/getPrivyUser";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles POST /api/auth/link-wallet: verifies the wallet belongs to the
 * caller's Privy account, then merges a legacy account that owns it or writes
 * the wallet on the current account.
 *
 * @param request - The request; a signed-in user's Privy token and `{ walletAddress }`.
 * @returns 200 with `{ status, success, merged, userId?, message }`; 400, 401, 403, 409, 500 or 503.
 */
export async function postLinkWalletHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  const error = (status: number, message: string) =>
    NextResponse.json({ status: "error", error: message }, { status, headers });

  try {
    // Inside the try: the auth lookup reads the database, and a failure there
    // must answer with the JSON error and CORS headers, not an empty 500.
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const body = await validateLinkWalletBody(request);
    if (body instanceof NextResponse) return body;
    const normalizedWallet = body.walletAddress;

    const currentUser = await withDbRetry(() => getUserById(auth.userId));
    if (!currentUser?.privyUserId) return error(401, "Not authenticated");

    // A browser callback is not proof of wallet ownership. Verify the linked
    // wallet against the authenticated Privy account before exposing/merging data.
    const privyUser = await getPrivyUser(currentUser.privyUserId);
    if (!privyUser) return error(503, "Wallet verification unavailable. Please try again.");
    const ownsWallet =
      privyUser.id === currentUser.privyUserId &&
      privyUser.linkedAccounts.some(
        account => account.type === "wallet" && account.address.toLowerCase() === normalizedWallet,
      );
    if (!ownsWallet) return error(403, "Wallet is not linked to your authenticated account.");

    // Check if this wallet belongs to a legacy user
    const legacyUser = await getUserByWallet(normalizedWallet);

    if (legacyUser) {
      // Legacy user found - check if already linked to Privy
      if (legacyUser.privyUserId)
        return error(409, "This wallet is already linked to another account");

      // Perform account merge
      const mergeResult = await mergeAccounts(currentUser.id, legacyUser.id);
      if (!mergeResult.success) return error(500, mergeResult.error || "Merge failed");

      return NextResponse.json(
        {
          status: "ok",
          success: true,
          merged: true,
          userId: legacyUser.id,
          message: "Account merged successfully! Your contribution history has been restored.",
        },
        { status: 200, headers },
      );
    }

    // No legacy user - just link the wallet to current user
    await linkWalletToUser(currentUser.id, normalizedWallet);
    return NextResponse.json(
      { status: "ok", success: true, merged: false, message: "Wallet linked successfully!" },
      { status: 200, headers },
    );
  } catch (e) {
    console.error("[LinkWallet] Error:", e);
    return error(500, "Failed to link wallet");
  }
}
