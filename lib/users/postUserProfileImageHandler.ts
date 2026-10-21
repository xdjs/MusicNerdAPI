import { NextResponse } from "next/server";
import sharp from "sharp";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { uploadStorageObject } from "@/lib/storage/uploadStorageObject";
import { PROFILE_IMAGE_BUCKET, PROFILE_IMAGE_MAX_BYTES } from "@/lib/users/const";
import { resolveProfileImageOwner } from "@/lib/users/resolveProfileImageOwner";

const TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * POST /api/user/profile-image: replaces the caller's photo. The upload is
 * decoded, bounded, rotated, cropped to 512x512 and re-encoded as WebP, which
 * strips its metadata, then stored as `avatar.webp` in the caller's folder.
 *
 * @param request - Multipart form data with `file`, and a Privy bearer token.
 * @returns 200 `{ status: "ok", success: true }`, or 400, 401, 409, 413 or 503.
 */
export async function postUserProfileImageHandler(request: Request) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;
  const headers = getCorsHeaders();
  const error = (message: string, status: number) =>
    NextResponse.json({ status: "error", error: message }, { status, headers });
  if (Number(request.headers.get("content-length")) > PROFILE_IMAGE_MAX_BYTES + 65536)
    return error("Choose an image smaller than 2 MB", 413);
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      file.size === 0 ||
      file.size > PROFILE_IMAGE_MAX_BYTES ||
      !TYPES.includes(file.type)
    )
      return error("Choose a JPG, PNG or WebP image smaller than 2 MB", 400);
    let output: Buffer;
    try {
      const input = sharp(Buffer.from(await file.arrayBuffer()), {
        limitInputPixels: 20_000_000,
        animated: false,
      });
      const metadata = await input.metadata();
      if (!["jpeg", "png", "webp"].includes(metadata.format ?? ""))
        throw new Error("Unsupported image");
      output = await input
        .rotate()
        .resize(512, 512, { fit: "cover" })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      return error("This image could not be read. Try another JPG, PNG or WebP.", 400);
    }
    const resolved = await resolveProfileImageOwner(request, auth.userId);
    if (resolved instanceof NextResponse) return resolved;
    await uploadStorageObject(PROFILE_IMAGE_BUCKET, `${resolved.folder}/avatar.webp`, output, {
      contentType: "image/webp",
      upsert: true,
      cacheControl: "0",
    });
    return NextResponse.json(
      { status: "ok", success: true },
      { headers: { ...headers, "Cache-Control": "private, no-store" } },
    );
  } catch {
    return error("Could not save your profile photo. Try again.", 503);
  }
}
