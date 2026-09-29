import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const bodySchema = z.object({ artistId: z.uuid().optional() });

/**
 * Reads POST /api/research/advance's body. An empty or unreadable body means
 * "any artist", as MusicNerdWeb's route treated it.
 *
 * @param request - The incoming request.
 * @returns The parsed body, or a 400 response when `artistId` is not a UUID.
 */
export async function validateAdvanceResearchBody(
  request: Request,
): Promise<z.infer<typeof bodySchema> | NextResponse> {
  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body ?? {});
  if (parsed.success) return parsed.data;
  return NextResponse.json(
    { status: "error", error: "artistId must be a UUID" },
    { status: 400, headers: getCorsHeaders() },
  );
}
