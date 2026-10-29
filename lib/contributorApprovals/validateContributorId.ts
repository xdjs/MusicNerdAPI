import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const idSchema = z.uuid();

/**
 * Validates the contributor `id` in /api/admin/users/{id}/submissions paths.
 *
 * @param id - The user id from the path.
 * @returns The id, or a 400 with `{ status: "error", error }`.
 */
export function validateContributorId(id: string): string | NextResponse {
  if (idSchema.safeParse(id).success) return id;
  return NextResponse.json(
    { status: "error", error: "Invalid user ID" },
    { status: 400, headers: getCorsHeaders() },
  );
}
