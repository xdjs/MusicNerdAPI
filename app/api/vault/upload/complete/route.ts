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
 * and queues a Lore refresh. Idempotent for the same ticket.
 *
 * @param request - The request; a claimant or admin Privy token, JSON `{ ticket }`.
 * @returns 200 with `{ status, source, warning? }`, or an error (`retryCompletion: true` asks for the same ticket again).
 */
export async function POST(request: Request) {
  return postCompleteUploadHandler(request);
}
