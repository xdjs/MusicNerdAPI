import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const idsSchema = z
  .array(z.string().regex(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i))
  .min(1)
  .max(6);

/**
 * The `id` query of GET /api/profile/artist-summaries: one to six artist UUIDs.
 *
 * @param request - The request.
 * @returns The distinct ids, or a 400 response.
 */
export function validateArtistSummariesQuery(request: Request): string[] | NextResponse {
  const ids = [...new Set(new URL(request.url).searchParams.getAll("id"))];
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success)
    return NextResponse.json(
      { status: "error", error: "Provide up to six artist IDs" },
      { status: 400, headers: getCorsHeaders() },
    );
  return parsed.data;
}
