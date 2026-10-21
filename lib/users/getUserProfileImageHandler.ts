import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createSignedStorageUrl } from "@/lib/storage/createSignedStorageUrl";
import { listStorageObjects } from "@/lib/storage/listStorageObjects";
import { PROFILE_IMAGE_BUCKET, PROFILE_IMAGE_URL_SECONDS } from "@/lib/users/const";
import { resolveProfileImageOwner } from "@/lib/users/resolveProfileImageOwner";

/**
 * GET /api/user/profile-image: a one-hour signed URL for the caller's photo.
 * Looks in the identity folder, then the account-id folder older uploads used.
 *
 * @param request - The request, with a Privy bearer token.
 * @returns 200 `{ status: "ok", userId, url }` (url null when there is none), or 401, 409 or 503.
 */
export async function getUserProfileImageHandler(request: Request) {
  const headers = getCorsHeaders();
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const resolved = await resolveProfileImageOwner(request, auth.userId);
    if (resolved instanceof NextResponse) return resolved;
    const { owner, folder } = resolved;
    let photoFolder: string | null = null;
    for (const candidate of [...new Set([folder, owner.id])]) {
      const files = await listStorageObjects(PROFILE_IMAGE_BUCKET, candidate, {
        limit: 1,
        search: "avatar.webp",
      });
      if (files.some(file => file.name === "avatar.webp")) {
        photoFolder = candidate;
        break;
      }
    }
    const noStore = { ...headers, "Cache-Control": "private, no-store" };
    if (!photoFolder)
      return NextResponse.json({ status: "ok", userId: owner.id, url: null }, { headers: noStore });
    const signedUrl = await createSignedStorageUrl(
      PROFILE_IMAGE_BUCKET,
      `${photoFolder}/avatar.webp`,
      PROFILE_IMAGE_URL_SECONDS,
    );
    return NextResponse.json(
      { status: "ok", userId: owner.id, url: `${signedUrl}&v=${Date.now()}` },
      { headers: noStore },
    );
  } catch {
    return NextResponse.json(
      { status: "error", error: "Could not load your profile photo" },
      { status: 503, headers },
    );
  }
}
