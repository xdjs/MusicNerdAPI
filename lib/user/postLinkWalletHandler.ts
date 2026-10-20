import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getPrivyClient } from "@/lib/auth/getPrivyClient";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { db } from "@/lib/db/db";

export async function postLinkWalletHandler(request: Request): Promise<NextResponse> {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  let walletAddress: string;
  try {
    const body = await request.json();
    walletAddress = body.walletAddress;
  } catch {
    return NextResponse.json(
      { status: "error", error: "Invalid request body" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  if (typeof walletAddress !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return NextResponse.json(
      { status: "error", error: "Invalid wallet address" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const normalizedWallet = walletAddress.toLowerCase();

  const userRows = await db.execute(
    sql`SELECT privy_user_id FROM users WHERE id = ${auth.userId}::uuid`,
  );
  const privyUserId = (userRows[0] as { privy_user_id: string } | undefined)?.privy_user_id;
  if (!privyUserId) {
    return NextResponse.json(
      { status: "error", error: "Account not linked to Privy" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const privy = getPrivyClient();
  let privyUser;
  try {
    privyUser = await privy.getUser(privyUserId);
  } catch {
    return NextResponse.json(
      { status: "error", error: "Wallet verification unavailable. Please try again." },
      { status: 503, headers: getCorsHeaders() },
    );
  }

  const ownsWallet = privyUser?.linkedAccounts?.some(
    (account: { type: string; address?: string }) =>
      account.type === "wallet" && account.address?.toLowerCase() === normalizedWallet,
  );
  if (!ownsWallet) {
    return NextResponse.json(
      { status: "error", error: "Wallet is not linked to your authenticated account." },
      { status: 403, headers: getCorsHeaders() },
    );
  }

  const legacyRows = await db.execute(
    sql`SELECT id, privy_user_id FROM users WHERE lower(wallet) = ${normalizedWallet} AND id != ${auth.userId}::uuid LIMIT 1`,
  );
  const legacyUser = legacyRows[0] as { id: string; privy_user_id: string | null } | undefined;

  if (legacyUser) {
    if (legacyUser.privy_user_id) {
      return NextResponse.json(
        { status: "error", error: "This wallet is already linked to another account" },
        { status: 409, headers: getCorsHeaders() },
      );
    }
    await db.execute(sql`
      UPDATE artist_claims SET user_id = ${legacyUser.id}::uuid WHERE user_id = ${auth.userId}::uuid;
      UPDATE ugcresearch SET user_id = ${legacyUser.id}::uuid WHERE user_id = ${auth.userId}::uuid;
      UPDATE users SET privy_user_id = ${privyUserId} WHERE id = ${legacyUser.id}::uuid;
    `);
    return NextResponse.json(
      {
        status: "ok",
        merged: true,
        userId: legacyUser.id,
        message: "Account merged successfully! Your contribution history has been restored.",
      },
      { headers: getCorsHeaders() },
    );
  }

  await db.execute(
    sql`UPDATE users SET wallet = ${normalizedWallet} WHERE id = ${auth.userId}::uuid`,
  );
  return NextResponse.json(
    {
      status: "ok",
      merged: false,
      message: "Wallet linked successfully!",
    },
    { headers: getCorsHeaders() },
  );
}
