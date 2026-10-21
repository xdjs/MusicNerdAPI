import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { canEditArtist } from "@/lib/auth/canEditArtist";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { LORE_UPLOAD_BUCKET } from "@/lib/storage/const";
import { createSignedUploadUrl } from "@/lib/storage/createSignedUploadUrl";
import { UPLOAD_TICKET_TTL_MS, VAULT_UPLOAD_TYPES } from "@/lib/vaultUpload/const";
import { resolveUploadType } from "@/lib/vaultUpload/resolveUploadType";
import { signUploadTicket } from "@/lib/vaultUpload/signUploadTicket";
import { validateSignUploadBody } from "@/lib/vaultUpload/validateSignUploadBody";

/**
 * Handles POST /api/vault/upload/sign: checks the file's name, type and size,
 * stages a storage key under the artist, and returns the signed URL to `PUT`
 * the file to with a ticket, bound to the user, for `complete`.
 *
 * @param request - The request; a claimant or admin Privy token, JSON `{ artistId, name, type, size }`.
 * @returns 200 with `{ status, signedUrl, contentType, ticket }`; 400, 401, 403 or 500.
 */
export async function postSignUploadHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const body = await validateSignUploadBody(request);
    if (body instanceof NextResponse) return body;
    const { artistId, name, type, size } = body;
    if (!(await canEditArtist(auth.userId, artistId)))
      return NextResponse.json(
        { status: "error", error: "Not authorized for this artist" },
        { status: 403, headers },
      );
    const resolvedType = resolveUploadType(name, type, VAULT_UPLOAD_TYPES);
    if (!resolvedType)
      return NextResponse.json(
        { status: "error", error: "File type not supported" },
        { status: 400, headers },
      );
    const path = `${artistId}/${randomUUID()}_${name.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
    const signedUrl = await createSignedUploadUrl(LORE_UPLOAD_BUCKET, path);
    const ticket = signUploadTicket({
      userId: auth.userId,
      artistId,
      path,
      name,
      type: resolvedType,
      size,
      expires: Date.now() + UPLOAD_TICKET_TTL_MS,
    });
    return NextResponse.json(
      { status: "ok", signedUrl, contentType: resolvedType, ticket },
      { status: 200, headers },
    );
  } catch (error) {
    console.error("[vault/upload/sign]", error);
    return NextResponse.json(
      { status: "error", error: "Could not prepare file storage. Please try again." },
      { status: 500, headers },
    );
  }
}
