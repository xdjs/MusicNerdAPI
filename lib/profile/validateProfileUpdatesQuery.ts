import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { PROFILE_UPDATE_KINDS } from "@/lib/profile/const";

/**
 * The query of GET /api/profile/updates: `offset` (one to six digits, default
 * 0) and `kind`, a filter named in `PROFILE_UPDATE_KINDS` (default `All`).
 *
 * @param request - The request.
 * @returns `{ offset, filter }`, or a 400 response naming the bad parameter.
 */
export function validateProfileUpdatesQuery(
  request: Request,
): { offset: number; filter: string } | NextResponse {
  const params = new URL(request.url).searchParams;
  const error = (message: string) =>
    NextResponse.json(
      { status: "error", error: message },
      { status: 400, headers: getCorsHeaders() },
    );
  const rawOffset = params.get("offset") ?? "0";
  if (!/^\d{1,6}$/.test(rawOffset)) return error("Invalid offset");
  const filter = params.get("kind") ?? "All";
  if (!Object.hasOwn(PROFILE_UPDATE_KINDS, filter)) return error("Invalid filter");
  return { offset: Number(rawOffset), filter };
}
