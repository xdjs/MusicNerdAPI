import { NextResponse } from "next/server";
import { WALLET_ADDRESS_REGEX } from "@/lib/account/const";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Reads `{ walletAddress }`: JSON with a `0x` address of 40 hex characters.
 *
 * @param request - The request.
 * @returns The wallet, lower-cased, or a 400 response.
 */
export async function validateLinkWalletBody(
  request: Request,
): Promise<{ walletAddress: string } | NextResponse> {
  let walletAddress: unknown;
  try {
    const body = (await request.json()) as { walletAddress?: unknown } | null;
    walletAddress = body?.walletAddress;
  } catch {
    return NextResponse.json(
      { status: "error", error: "Invalid request body" },
      { status: 400, headers: getCorsHeaders() },
    );
  }
  if (typeof walletAddress !== "string" || !WALLET_ADDRESS_REGEX.test(walletAddress)) {
    return NextResponse.json(
      { status: "error", error: "Invalid wallet address" },
      { status: 400, headers: getCorsHeaders() },
    );
  }
  return { walletAddress: walletAddress.toLowerCase() };
}
