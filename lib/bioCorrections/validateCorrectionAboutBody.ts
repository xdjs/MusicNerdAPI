import { NextResponse } from "next/server";
import { MAX_BIO_LENGTH } from "@/lib/bio/const";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Reads PUT /api/admin/bio-corrections/{id}/about's body: a non-empty bio up to
 * the length limit and the 64-hex revision it was edited from.
 *
 * @param request - The incoming request.
 * @returns The trimmed bio and revision, or a 400 response.
 */
export async function validateCorrectionAboutBody(
  request: Request,
): Promise<{ bio: string; revision: string } | NextResponse> {
  const body = await request.json().catch(() => null);
  if (
    typeof body?.bio === "string" &&
    body.bio.trim() &&
    body.bio.length <= MAX_BIO_LENGTH &&
    typeof body?.revision === "string" &&
    /^[a-f0-9]{64}$/.test(body.revision)
  )
    return { bio: body.bio.trim(), revision: body.revision };
  return NextResponse.json(
    { status: "error", error: "Enter a valid About and reload the editor if needed." },
    { status: 400, headers: getCorsHeaders() },
  );
}
