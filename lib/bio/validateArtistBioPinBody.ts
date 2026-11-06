import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const bodySchema = z.object({ versionId: z.uuid() });

/**
 * Validates the body of PUT /api/artistBio/{id}/pin: the saved bio to pin.
 *
 * @param body - The parsed JSON body.
 * @returns `{ versionId }`, or a 400.
 */
export function validateArtistBioPinBody(body: unknown): { versionId: string } | NextResponse {
  const parsed = bodySchema.safeParse(body);
  if (parsed.success) return parsed.data;
  return NextResponse.json(
    { status: "error", error: "versionId must be a UUID" },
    { status: 400, headers: getCorsHeaders() },
  );
}
