import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { canEditArtist } from "@/lib/auth/canEditArtist";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getLoreClaimGeneration } from "@/lib/ownership/getLoreClaimGeneration";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";
import { queueLoreRefresh } from "@/lib/research/queueLoreRefresh";
import { VAULT_BUCKET } from "@/lib/storage/const";
import { getPublicUrl } from "@/lib/storage/getPublicUrl";
import { isSupabaseStorageConfigured } from "@/lib/storage/isSupabaseStorageConfigured";
import { removeObjects } from "@/lib/storage/removeObjects";
import { uploadObject } from "@/lib/storage/uploadObject";
import { insertVaultSource } from "@/lib/vault/insertVaultSource";
import {
  MAX_VAULT_FILE_BYTES,
  MIME_EXT_MAP,
  VAULT_UPLOAD_LIMIT_LABEL,
  VAULT_UPLOAD_TYPES,
} from "@/lib/vaultUpload/const";
import { extractPdfText } from "@/lib/vaultUpload/extractPdfText";
import { formatFileSize } from "@/lib/vaultUpload/formatFileSize";
import { getUploadSourceType } from "@/lib/vaultUpload/getUploadSourceType";
import { resolveUploadType } from "@/lib/vaultUpload/resolveUploadType";
import { validateMagicBytes } from "@/lib/vaultUpload/validateMagicBytes";
import { validateUploadForm } from "@/lib/vaultUpload/validateUploadForm";

/**
 * Handles POST /api/vault/upload, the single-request direct upload the site
 * used before the sign-and-complete flow: checks the file, stores it in the
 * vault bucket, saves the source as approved and queues a Lore refresh.
 *
 * @param request - The request; a claimant or admin Privy token, `multipart/form-data` with `file` and `artistId`.
 * @returns 200 with `{ status, success, source, warning? }`; 400, 401, 403, 500 or 503.
 */
export async function postUploadHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  const error = (status: number, message: string) =>
    NextResponse.json({ status: "error", error: message }, { status, headers });
  let unpublishedPath: string | undefined;
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;
    const form = await validateUploadForm(request);
    if (form instanceof NextResponse) return form;
    const { file, artistId } = form;

    const expectedClaimId = await getLoreClaimGeneration(artistId);
    if (!(await canEditArtist(userId, artistId)))
      return error(403, "Not authorized for this artist");

    if (file.size > MAX_VAULT_FILE_BYTES) {
      console.error("[vault/upload] rejected:", {
        name: file.name,
        type: file.type,
        size: file.size,
        reason: "too_large",
      });
      return error(
        400,
        `File too large: ${formatFileSize(file.size)} (maximum ${VAULT_UPLOAD_LIMIT_LABEL})`,
      );
    }

    // Browsers report an empty or nonstandard `file.type` for some formats
    // (notably .md, sometimes .csv); fall back to the extension. The resolved
    // type drives the rest: magic bytes, storage content type, extraction, the row.
    const resolvedType = resolveUploadType(file.name, file.type, VAULT_UPLOAD_TYPES);
    if (!resolvedType) {
      console.error("[vault/upload] rejected:", {
        name: file.name,
        type: file.type,
        size: file.size,
        reason: "unsupported_type",
      });
      return error(
        400,
        `File type not supported: "${file.type || "unknown"}". Supported: PDF, TXT, MD, CSV, JSON, DOCX, images, audio.`,
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (!validateMagicBytes(buffer, resolvedType)) {
      console.error("[vault/upload] rejected:", {
        name: file.name,
        type: file.type,
        size: file.size,
        reason: "magic_byte_mismatch",
        header: Array.from(buffer.subarray(0, 8))
          .map(b => b.toString(16).padStart(2, "0"))
          .join(" "),
      });
      return error(400, "File content does not match declared type");
    }

    // Fail fast with a clear message when the storage credentials are absent,
    // instead of a generic 500 from the first storage call.
    if (!isSupabaseStorageConfigured()) {
      console.error(
        "[vault/upload] storage not configured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing",
      );
      return error(
        503,
        "File storage is not configured on this server (missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
      );
    }

    // Every allowed type has an extension; the fallback is a safety net only.
    const ext = MIME_EXT_MAP[resolvedType] ?? "";
    const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
    const storagePath = `${artistId}/${Date.now()}_${baseName}${ext}`;

    try {
      await uploadObject(VAULT_BUCKET, storagePath, buffer, resolvedType);
    } catch (uploadError) {
      console.error("[vault/upload] Supabase upload error:", uploadError);
      return error(500, "Failed to upload file to storage");
    }

    unpublishedPath = storagePath;
    const publicUrl = getPublicUrl(VAULT_BUCKET, storagePath);

    // Text for Lore: decoded for text formats, parsed for PDFs.
    let extractedText: string | undefined;
    if (
      resolvedType === "text/plain" ||
      resolvedType === "text/markdown" ||
      resolvedType === "text/csv" ||
      resolvedType === "application/json"
    ) {
      extractedText = new TextDecoder().decode(bytes);
    } else if (resolvedType === "application/pdf") {
      extractedText = (await extractPdfText(buffer)) ?? undefined;
      if (!extractedText)
        console.warn(
          `[vault/upload] No text extracted from PDF "${file.name}" (image-only or empty?)`,
        );
    }

    // `filePath` is the storage key, not the public URL, so a per-file
    // deletion can remove it directly; `url` is what browsers load.
    const source = await insertVaultSource(
      {
        artistId,
        url: publicUrl,
        title: file.name,
        snippet: extractedText
          ? extractedText.slice(0, 300)
          : `Uploaded file: ${file.name} (${formatFileSize(file.size)})`,
        type: getUploadSourceType(resolvedType),
        status: "approved",
        fileName: file.name,
        fileSize: file.size,
        filePath: storagePath,
        contentType: resolvedType,
        extractedText: extractedText ?? null,
      },
      { userId, trigger: "upload" },
      { userId, expectedClaimId },
    );
    unpublishedPath = undefined;

    let refreshWarning: string | undefined;
    try {
      await queueLoreRefresh(artistId, expectedClaimId, { userId, trigger: "upload" });
    } catch (queueError) {
      console.error("[vault/upload] Saved upload; Lore enqueue failed", queueError);
      refreshWarning = "File saved. Use Look again to retry the Lore refresh; do not upload again.";
    }
    const warning =
      [
        refreshWarning,
        resolvedType === "application/pdf" && !extractedText
          ? "PDF saved, but no readable text was found. Upload a text-based PDF to use it in Lore."
          : undefined,
      ]
        .filter(Boolean)
        .join(" ") || undefined;
    return NextResponse.json(
      { status: "ok", success: true, source, warning },
      { status: 200, headers },
    );
  } catch (caught) {
    if (caught instanceof OwnershipChangedError && unpublishedPath) {
      try {
        await removeObjects(VAULT_BUCKET, [unpublishedPath]);
      } catch (cleanupError) {
        console.error("[vault/upload] Rejected upload cleanup failed", cleanupError);
      }
    }
    console.error("[vault/upload] Error:", caught);
    if (caught instanceof OwnershipChangedError) return error(403, caught.message);
    return error(500, "Failed to upload file");
  }
}
