import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const schema = z.object({
  page: z
    .string()
    .default("1")
    .transform(Number)
    .refine(page => Number.isSafeInteger(page) && page >= 1),
});

/**
 * The profile-edit history's query: `page`, a whole number from 1 (default 1),
 * as on MusicNerdWeb.
 *
 * @param request - The request.
 * @returns `{ page }`, or a 400 response.
 */
export function validateSelfEditsQuery(request: Request): { page: number } | NextResponse {
  const page = new URL(request.url).searchParams.get("page");
  const result = schema.safeParse({ page: page ?? undefined });
  if (!result.success)
    return NextResponse.json(
      { status: "error", error: "Invalid page" },
      { status: 400, headers: getCorsHeaders() },
    );
  return result.data;
}
