import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const idSchema = z.uuid();

/**
 * Validates the artist id in the path of POST /api/artist/{id}/claim.
 *
 * @param id - The artist id from the path.
 * @returns The id, or a 400 with `{ status: "error", error }` and CORS headers.
 */
export function validateClaimArtistId(id: string): string | NextResponse {
  if (idSchema.safeParse(id).success) return id;
  return NextResponse.json(
    { status: "error", error: "Invalid artist ID" },
    { status: 400, headers: getCorsHeaders() },
  );
}
