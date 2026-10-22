import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const schema = z.uuid();

/**
 * The `artistId` query parameter of GET /api/artist/photo-choice.
 *
 * @param request - The request.
 * @returns The artist id, or a 400 `{ status: "error", error: "Invalid artist" }`.
 */
export function validatePhotoChoiceQuery(request: Request): string | NextResponse {
  const parsed = schema.safeParse(new URL(request.url).searchParams.get("artistId"));
  if (!parsed.success)
    return NextResponse.json(
      { status: "error", error: "Invalid artist" },
      { status: 400, headers: { ...getCorsHeaders(), "Cache-Control": "no-store" } },
    );
  return parsed.data;
}
