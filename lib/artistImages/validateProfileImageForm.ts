import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * The multipart form of POST /api/artist/profile-image: a `file` and an
 * `artistId`. The id must be a UUID because it names the stored object.
 *
 * @param request - The request.
 * @returns The file and artist id, or a 400 `{ status: "error", error }`.
 */
export async function validateProfileImageForm(
  request: Request,
): Promise<{ file: File; artistId: string } | NextResponse> {
  const headers = getCorsHeaders();
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const artistId = formData?.get("artistId");
  if (!(file instanceof File) || typeof artistId !== "string" || !artistId)
    return NextResponse.json(
      { status: "error", error: "File and artistId are required" },
      { status: 400, headers },
    );
  if (!z.uuid().safeParse(artistId).success)
    return NextResponse.json(
      { status: "error", error: "Invalid artist" },
      { status: 400, headers },
    );
  return { file, artistId };
}
