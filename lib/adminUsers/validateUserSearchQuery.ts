import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const schema = z.string().trim().min(3).optional();

/**
 * Reads the query of GET /api/admin/users: an optional `search` of at least 3
 * characters, the length the admin's search box waits for. Absent or blank
 * means every user, as MusicNerdWeb's admin page listed them.
 *
 * @param request - The request.
 * @returns `{ search }` trimmed (undefined for every user), or a 400 with `{ status: "error", error }`.
 */
export function validateUserSearchQuery(
  request: Request,
): { search: string | undefined } | NextResponse {
  const raw = new URL(request.url).searchParams.get("search")?.trim() || undefined;
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { search: parsed.data };
  return NextResponse.json(
    { status: "error", error: "Search must be at least 3 characters" },
    { status: 400, headers: getCorsHeaders() },
  );
}
