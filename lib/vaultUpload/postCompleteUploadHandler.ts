import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { canEditArtist } from "@/lib/auth/canEditArtist";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getLoreClaimGeneration } from "@/lib/ownership/getLoreClaimGeneration";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";
import { LORE_UPLOAD_BUCKET, VAULT_BUCKET } from "@/lib/storage/const";
import { downloadObject } from "@/lib/storage/downloadObject";
import { getPublicUrl } from "@/lib/storage/getPublicUrl";
import { removeObjects } from "@/lib/storage/removeObjects";
import { uploadObject } from "@/lib/storage/uploadObject";
import { getVaultUploadByPath } from "@/lib/vault/getVaultUploadByPath";
import { insertVaultSource } from "@/lib/vault/insertVaultSource";
import { cleanupSavedUpload } from "@/lib/vaultUpload/cleanupSavedUpload";
import { MAX_VAULT_FILE_BYTES } from "@/lib/vaultUpload/const";
import { extractPdfText } from "@/lib/vaultUpload/extractPdfText";
import { getUploadSourceType } from "@/lib/vaultUpload/getUploadSourceType";
import { refreshAfterUpload } from "@/lib/vaultUpload/refreshAfterUpload";
import { removeStagedUpload } from "@/lib/vaultUpload/removeStagedUpload";
import { validateCompleteUploadBody } from "@/lib/vaultUpload/validateCompleteUploadBody";
import { validateMagicBytes } from "@/lib/vaultUpload/validateMagicBytes";
import { verifyUploadTicket } from "@/lib/vaultUpload/verifyUploadTicket";

/**
 * Handles POST /api/vault/upload/complete: checks the staged file against its
 * ticket, extracts its text, publishes it to the vault, saves the source as
 * approved and queues a Lore refresh. Completing the same ticket again
 * returns the saved source. A `retryCompletion: true` error asks for the same
 * ticket again, never a new upload.
 *
 * @param request - The request; a claimant or admin Privy token, JSON `{ ticket }`.
 * @returns 200 with `{ status, source, warning? }`; 400, 401, 403, 500 or 503.
 */
export async function postCompleteUploadHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  const error = (status: number, message: string, retryCompletion?: true) =>
    NextResponse.json(
      { status: "error", error: message, ...(retryCompletion ? { retryCompletion } : {}) },
      { status, headers },
    );
  let userId = "";
  let unpublishedPath: string | undefined;
  let uploadArtistId: string | undefined;
  let uploadClaimId: string | null = null;
  let stagedPath: string | undefined;
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    userId = auth.userId;
    const body = await validateCompleteUploadBody(request);
    if (body instanceof NextResponse) return body;
    let ticket;
    try {
      ticket = verifyUploadTicket(body.ticket, userId);
    } catch {
      return error(400, "Upload expired or invalid. Please try again.");
    }
    stagedPath = ticket.path;
    if (ticket.expires < Date.now()) {
      await removeStagedUpload(ticket.path);
      return error(400, "Upload expired. Please try again.");
    }
    const expectedClaimId = await getLoreClaimGeneration(ticket.artistId);
    if (!(await canEditArtist(userId, ticket.artistId))) {
      // The signed, user-bound ticket authorizes cleanup of this temporary
      // object only, even if artist editing permission has since changed.
      await removeStagedUpload(ticket.path);
      return error(403, "Not authorized for this artist");
    }
    uploadClaimId = expectedClaimId;
    uploadArtistId = ticket.artistId;
    const prior = await getVaultUploadByPath(ticket.artistId, ticket.path);
    if (prior) {
      const warning = await refreshAfterUpload(ticket.artistId, expectedClaimId, userId);
      await cleanupSavedUpload(ticket.path);
      return NextResponse.json({ status: "ok", source: prior, warning }, { status: 200, headers });
    }
    const buffer = await downloadObject(LORE_UPLOAD_BUCKET, ticket.path);
    if (buffer.length !== ticket.size || buffer.length > MAX_VAULT_FILE_BYTES) {
      await removeStagedUpload(ticket.path);
      return error(400, "File size does not match the approved upload");
    }
    if (!validateMagicBytes(buffer, ticket.type)) {
      await removeStagedUpload(ticket.path);
      return error(400, "File content does not match its type");
    }
    const extractedText =
      ticket.type === "application/pdf"
        ? await extractPdfText(buffer)
        : ticket.type.startsWith("text/") || ticket.type === "application/json"
          ? buffer.toString("utf8")
          : null;
    await uploadObject(VAULT_BUCKET, ticket.path, buffer, ticket.type, { upsert: true });
    unpublishedPath = ticket.path;
    const url = getPublicUrl(VAULT_BUCKET, ticket.path);
    const inserted = await insertVaultSource(
      {
        artistId: ticket.artistId,
        url,
        title: ticket.name,
        snippet: extractedText?.slice(0, 300) ?? `Uploaded file: ${ticket.name}`,
        extractedText,
        type: getUploadSourceType(ticket.type),
        status: "approved",
        fileName: ticket.name,
        fileSize: buffer.length,
        filePath: ticket.path,
        contentType: ticket.type,
      },
      { userId, trigger: "upload" },
      { userId, expectedClaimId },
    );
    const source = inserted ?? (await getVaultUploadByPath(ticket.artistId, ticket.path));
    if (!source) throw new Error("Upload source was not saved");
    unpublishedPath = undefined;
    const refreshWarning = await refreshAfterUpload(ticket.artistId, expectedClaimId, userId);
    await cleanupSavedUpload(ticket.path);
    const warning =
      [
        refreshWarning,
        ticket.type === "application/pdf" && !extractedText
          ? "PDF saved, but no readable text was found. Use a text-based PDF so Lore can read it."
          : undefined,
      ]
        .filter(Boolean)
        .join(" ") || undefined;
    return NextResponse.json({ status: "ok", source, warning }, { status: 200, headers });
  } catch (caught) {
    if (unpublishedPath && uploadArtistId) {
      try {
        // A lost transaction response is not proof that INSERT rolled back.
        // Never delete a committed upload on an ambiguous network failure.
        const saved = await getVaultUploadByPath(uploadArtistId, unpublishedPath);
        if (saved && !(caught instanceof OwnershipChangedError)) {
          const warning = await refreshAfterUpload(uploadArtistId, uploadClaimId, userId);
          await cleanupSavedUpload(unpublishedPath);
          return NextResponse.json(
            { status: "ok", source: saved, warning },
            { status: 200, headers },
          );
        }
        if (!saved) await removeObjects(VAULT_BUCKET, [unpublishedPath]);
      } catch (recoveryError) {
        console.error(
          "[vault/upload/complete] Publication reconciliation needs retry",
          recoveryError,
        );
        return error(
          503,
          "Could not confirm the upload. Retry this same file to finish; do not create a new upload.",
          true,
        );
      }
    }
    console.error("[vault/upload/complete]", caught);
    if (caught instanceof OwnershipChangedError) {
      try {
        if (stagedPath) await removeStagedUpload(stagedPath);
      } catch (cleanupError) {
        console.error("[vault/upload/complete] Rejected upload cleanup needs retry", cleanupError);
        return error(503, "Could not clean up the rejected upload. Please retry this file.", true);
      }
      return error(403, caught.message);
    }
    return error(500, "Could not finish the upload. Please retry this file.", true);
  }
}
