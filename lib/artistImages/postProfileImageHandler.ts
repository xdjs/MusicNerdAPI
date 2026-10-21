import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  MAX_PROFILE_IMAGE_BYTES,
  PROFILE_IMAGE_EXTENSIONS,
  PROFILE_IMAGE_FOLDER,
  PROFILE_IMAGE_TYPES,
} from "@/lib/artistImages/const";
import { isSupabaseStorageConfigured } from "@/lib/artistImages/isSupabaseStorageConfigured";
import { profileImagePublicUrl } from "@/lib/artistImages/profileImagePublicUrl";
import { purgeStaleProfileImages } from "@/lib/artistImages/purgeStaleProfileImages";
import { uploadProfileImage } from "@/lib/artistImages/uploadProfileImage";
import { validateMagicBytes } from "@/lib/artistImages/validateMagicBytes";
import { validateProfileImageForm } from "@/lib/artistImages/validateProfileImageForm";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { canEditArtist } from "@/lib/auth/canEditArtist";
import { db } from "@/lib/db/db";
import { artists } from "@/lib/db/schema";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles POST /api/artist/profile-image: stores an uploaded PNG, JPEG or
 * WebP in the vault bucket, points the artist's `customImage` at its public
 * URL, then purges the artist's older uploads best-effort.
 *
 * @param request - The request; a claimant or admin Privy token, a multipart form with `file` and `artistId`.
 * @returns 200 with `{ status, success, imagePath }`; 400, 401, 403, 500 or 503.
 */
export async function postProfileImageHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  const error = (message: string, status: number) =>
    NextResponse.json({ status: "error", error: message }, { status, headers });
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const form = await validateProfileImageForm(request);
    if (form instanceof NextResponse) return form;
    const { file, artistId } = form;
    if (!(await canEditArtist(auth.userId, artistId)))
      return error("Not authorized for this artist", 403);
    if (file.size > MAX_PROFILE_IMAGE_BYTES) return error("Image too large (max 5MB)", 400);
    if (!PROFILE_IMAGE_TYPES.includes(file.type))
      return error("Only PNG, JPEG, and WebP images are supported", 400);
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!validateMagicBytes(buffer, file.type)) {
      console.error("[artist/profile-image] rejected:", {
        name: file.name,
        type: file.type,
        size: file.size,
        reason: "magic_byte_mismatch",
        header: Array.from(buffer.subarray(0, 8))
          .map(b => b.toString(16).padStart(2, "0"))
          .join(" "),
      });
      return error("Image content does not match declared type", 400);
    }
    if (!isSupabaseStorageConfigured()) {
      console.error(
        "[artist/profile-image] storage not configured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing",
      );
      return error(
        "Image storage is not configured on this server (missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
        503,
      );
    }
    const ext = PROFILE_IMAGE_EXTENSIONS[file.type] ?? ".bin";
    const filename = `${artistId}_${Date.now()}${ext}`;
    const storagePath = `${PROFILE_IMAGE_FOLDER}/${filename}`;
    if (!(await uploadProfileImage(storagePath, buffer, file.type)))
      return error("Failed to upload image to storage", 500);
    const publicUrl = profileImagePublicUrl(storagePath);
    await db.update(artists).set({ customImage: publicUrl }).where(eq(artists.id, artistId));
    await purgeStaleProfileImages(artistId, filename);
    return NextResponse.json(
      { status: "ok", success: true, imagePath: publicUrl },
      { status: 200, headers },
    );
  } catch (e) {
    console.error("[artist/profile-image] Error:", e);
    return error("Failed to upload image", 500);
  }
}
