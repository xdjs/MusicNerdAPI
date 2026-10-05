import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const artistIdSchema = z.uuid();

/**
 * Validates the path of GET /api/onboarding/{artistId}/state.
 *
 * @param artistId - The artist id from the path.
 * @returns The artist id, or a 400 with `{ status: "error", error }` and CORS headers.
 */
export function validateOnboardingStateParams(artistId: string): string | NextResponse {
  if (artistIdSchema.safeParse(artistId).success) return artistId;
  return NextResponse.json(
    { status: "error", error: "Invalid artist id" },
    { status: 400, headers: getCorsHeaders() },
  );
}
