import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const idSchema = z.uuid();

/**
 * Validates the claim id in an admin claim route's path.
 *
 * @param id - The claim id from the path.
 * @returns The id, or a 400 with `{ status: "error", error }` and CORS headers.
 */
export function validateClaimId(id: string): string | NextResponse {
  if (idSchema.safeParse(id).success) return id;
  return NextResponse.json(
    { status: "error", error: "Invalid claim ID" },
    { status: 400, headers: getCorsHeaders() },
  );
}
