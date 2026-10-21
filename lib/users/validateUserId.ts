import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const idSchema = z.uuid();

/**
 * Validates the path of PUT /api/admin/whitelist-user/{id}. MusicNerdWeb let a
 * non-UUID reach Postgres and reported it as "Error updating user".
 *
 * @param id - The user id from the path.
 * @returns The id, or a 400 with `{ status: "error", error }` and CORS headers.
 */
export function validateUserId(id: string): string | NextResponse {
  if (idSchema.safeParse(id).success) return id;
  return NextResponse.json(
    { status: "error", error: "Invalid user ID" },
    { status: 400, headers: getCorsHeaders() },
  );
}
