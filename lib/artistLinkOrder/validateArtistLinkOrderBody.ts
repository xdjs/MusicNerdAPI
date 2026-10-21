import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const artistLinkOrderSchema = z.object({
  artistId: z.uuid(),
  section: z.enum(["links", "support"]),
  order: z
    .array(z.string().min(1).max(80))
    .max(100)
    .refine(names => new Set(names).size === names.length),
});

/** A valid link-order body. */
export type ArtistLinkOrderBody = z.infer<typeof artistLinkOrderSchema>;

/**
 * Validates a PUT /api/artist/link-order body: an artist UUID, the section,
 * and at most 100 distinct names of 1-80 characters.
 *
 * @param body - The parsed JSON body, or null when it wasn't JSON.
 * @returns The body, or a 400 `Invalid link order`.
 */
export function validateArtistLinkOrderBody(body: unknown): ArtistLinkOrderBody | NextResponse {
  const parsed = artistLinkOrderSchema.safeParse(body);
  if (parsed.success) return parsed.data;
  return NextResponse.json(
    { status: "error", error: "Invalid link order" },
    { status: 400, headers: getCorsHeaders() },
  );
}
