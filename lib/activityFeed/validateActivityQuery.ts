import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const schema = z.object({
  since: z
    .string()
    .refine(value => !Number.isNaN(Date.parse(value)))
    .optional(),
});

/**
 * The activity feed's query: an optional `since`, anything `Date.parse`
 * accepts, as on MusicNerdWeb.
 *
 * @param request - The request.
 * @returns `{ since }` (undefined when absent), or a 400 response.
 */
export function validateActivityQuery(request: Request): { since?: string } | NextResponse {
  const since = new URL(request.url).searchParams.get("since");
  const result = schema.safeParse({ since: since ?? undefined });
  if (!result.success)
    return NextResponse.json(
      { status: "error", error: "Invalid since parameter" },
      { status: 400, headers: getCorsHeaders() },
    );
  return result.data;
}
