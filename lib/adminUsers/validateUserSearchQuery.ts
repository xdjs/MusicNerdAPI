import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const schema = z.string().trim().min(3);

/**
 * Reads the query of GET /api/admin/users: a `search` of at least 3
 * characters, the length the admin's search box waits for.
 *
 * @param request - The request.
 * @returns `{ search }` trimmed, or a 400 with `{ status: "error", error }`.
 */
export function validateUserSearchQuery(request: Request): { search: string } | NextResponse {
  const parsed = schema.safeParse(new URL(request.url).searchParams.get("search") ?? "");
  if (parsed.success) return { search: parsed.data };
  return NextResponse.json(
    { status: "error", error: "Search must be at least 3 characters" },
    { status: 400, headers: getCorsHeaders() },
  );
}
