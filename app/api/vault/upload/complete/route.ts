import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postCompleteUploadHandler } from "@/lib/vaultUpload/postCompleteUploadHandler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * CORS preflight.
 *
 * @returns 200 with the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * Completes a signed upload: checks the staged file against its ticket,
 * extracts its text, publishes it to the vault, saves the source as approved
 * and returns its receipt. Claim-bound uploads queue a Lore refresh; independent
 * contributions append only. Idempotent for the same ticket; removed contributions return 410.
 *
 * @param request - The request; an authenticated claimant/admin, or trusted contributor for unclaimed Lore, Privy token, JSON `{ ticket }`.
 * @returns 200 with `{ status, source, receiptOnly?, warning? }`, or an error (`retryCompletion: true` asks for the same ticket again).
 */
export async function POST(request: Request) {
  return postCompleteUploadHandler(request);
}
