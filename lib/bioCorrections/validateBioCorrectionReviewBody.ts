import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const schema = z.object({ status: z.enum(["resolved", "dismissed"]) });

/**
 * Validates the body of PATCH /api/admin/bio-corrections/{id}: the outcome.
 *
 * @param request - The request.
 * @returns `{ status }`, or a 400 with MusicNerdWeb's "Invalid review status" and CORS headers.
 */
export async function validateBioCorrectionReviewBody(
  request: Request,
): Promise<{ status: "resolved" | "dismissed" } | NextResponse> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (parsed.success) return parsed.data;
  return NextResponse.json(
    { status: "error", error: "Invalid review status" },
    { status: 400, headers: getCorsHeaders() },
  );
}
