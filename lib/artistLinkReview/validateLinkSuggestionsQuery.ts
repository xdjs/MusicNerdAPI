import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Validates GET /api/artist/{id}/link-suggestions: a UUID artist id and an
 * integer `offset` of 0-100000 (0 when absent).
 *
 * @param request - The request.
 * @param id - The artist id from the path.
 * @returns `{ artistId, offset }`, or a 400 `Invalid artist ID` / `Invalid page offset`.
 */
export function validateLinkSuggestionsQuery(
  request: Request,
  id: string,
): { artistId: string; offset: number } | NextResponse {
  const fail = (error: string) =>
    NextResponse.json({ status: "error", error }, { status: 400, headers: getCorsHeaders() });
  if (!z.uuid().safeParse(id).success) return fail("Invalid artist ID");
  const offset = Number(new URL(request.url).searchParams.get("offset") ?? 0);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000)
    return fail("Invalid page offset");
  return { artistId: id, offset };
}
