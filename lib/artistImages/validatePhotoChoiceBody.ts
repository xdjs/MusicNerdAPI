import { NextResponse } from "next/server";
import { z } from "zod";
import { PHOTO_SOURCES } from "@/lib/artistImages/const";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const schema = z
  .object({
    artistId: z.uuid(),
    source: z.enum(PHOTO_SOURCES),
    imageUrl: z.url().max(4096),
    expectedCustomImage: z.string().max(4096).nullable(),
    providerId: z.string().min(1).max(255),
  })
  .strict();

/** A validated photo choice. */
export type PhotoChoiceBody = z.infer<typeof schema>;

/**
 * The body of PATCH /api/artist/photo-choice: which provider photo to take,
 * plus what the caller saw so a stale choice is refused.
 *
 * @param request - The request.
 * @returns The parsed body, or a 400 `{ status: "error", error: "Invalid photo choice" }`.
 */
export async function validatePhotoChoiceBody(
  request: Request,
): Promise<PhotoChoiceBody | NextResponse> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { status: "error", error: "Invalid photo choice" },
      { status: 400, headers: { ...getCorsHeaders(), "Cache-Control": "no-store" } },
    );
  return parsed.data;
}
