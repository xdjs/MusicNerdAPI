import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * The direct upload's form: a `file` part and an `artistId` field.
 *
 * @param request - The request with a `multipart/form-data` body.
 * @returns `{ file, artistId }`, or a 400 with CORS headers.
 */
export async function validateUploadForm(
  request: Request,
): Promise<{ file: File; artistId: string } | NextResponse> {
  let file: FormDataEntryValue | null = null;
  let artistId: FormDataEntryValue | null = null;
  try {
    const form = await request.formData();
    file = form.get("file");
    artistId = form.get("artistId");
  } catch {
    // Not a form: reported like a missing field, below.
  }
  if (!(file instanceof File) || typeof artistId !== "string" || !artistId)
    return NextResponse.json(
      { status: "error", error: "File and artistId are required" },
      { status: 400, headers: getCorsHeaders() },
    );
  return { file, artistId };
}
