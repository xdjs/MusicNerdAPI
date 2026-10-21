import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Reads the artist id from the fun fact request's query string.
 *
 * @param request - The request; `?id=<artistId>`.
 * @returns The artist id, or a 400 when it is missing or empty.
 */
export function validateFunFactQuery(request: Request): { id: string } | NextResponse {
  const result = z
    .object({ id: z.string().min(1) })
    .safeParse({ id: new URL(request.url).searchParams.get("id") });
  if (!result.success)
    return NextResponse.json(
      { status: "error", error: "Missing artist id" },
      { status: 400, headers: { ...getCorsHeaders(), "Cache-Control": "no-store" } },
    );
  return result.data;
}
