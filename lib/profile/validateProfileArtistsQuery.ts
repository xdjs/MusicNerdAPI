import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const querySchema = z.object({
  offset: z.string().regex(/^\d{1,6}$/),
  query: z.string().max(200),
});

/**
 * The query of GET /api/profile/artists: `offset` (one to six digits, default
 * 0) and `q`, a name search of at most 200 characters after trimming.
 *
 * @param request - The request.
 * @returns `{ offset, query }`, or a 400 response.
 */
export function validateProfileArtistsQuery(
  request: Request,
): { offset: number; query: string } | NextResponse {
  const params = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    offset: params.get("offset") ?? "0",
    query: (params.get("q") ?? "").trim(),
  });
  if (!parsed.success)
    return NextResponse.json(
      { status: "error", error: "Invalid artist search" },
      { status: 400, headers: getCorsHeaders() },
    );
  return { offset: Number(parsed.data.offset), query: parsed.data.query };
}
