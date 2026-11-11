import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";
import { downloadObject } from "@/lib/storage/downloadObject";
import { getPublicUrl } from "@/lib/storage/getPublicUrl";
import { LORE_UPLOAD_BUCKET, VAULT_BUCKET } from "@/lib/storage/const";
import { independentUploadReceipt } from "./independentUploadReceipt";
import type { IndependentUploadTicket } from "./independentUploadTypes";
import { publishImmutableUpload } from "./publishImmutableUpload";
import { MAX_VAULT_FILE_BYTES, VAULT_UPLOAD_TYPES } from "./const";
import { validateMagicBytes } from "./validateMagicBytes";
import { extractPdfText } from "./extractPdfText";
import { getUploadSourceType } from "./getUploadSourceType";

/** Complete append-only trusted Lore without claimant operations or private-source reads. */
export async function completeIndependentLoreUpload(
  ticket: IndependentUploadTicket,
  directBytes?: Buffer,
): Promise<NextResponse> {
  const headers = getCorsHeaders();
  const error = (status: number, message: string) =>
    NextResponse.json({ status: "error", error: message }, { status, headers });
  const ok = (source: { id: string }) =>
    NextResponse.json(
      {
        status: "ok",
        success: true,
        source,
        receiptOnly: true,
        warning: "File saved to Lore.",
      },
      { status: 200, headers },
    );
  try {
    if (ticket.expires < Date.now()) return error(400, "Upload expired. Please start again.");
    const prior = await independentUploadReceipt(ticket);
    if (prior) return ok(prior);
    const bytes = directBytes ?? (await downloadObject(LORE_UPLOAD_BUCKET, ticket.path));
    if (
      bytes.length !== ticket.size ||
      bytes.length > MAX_VAULT_FILE_BYTES ||
      !VAULT_UPLOAD_TYPES.includes(ticket.type) ||
      !validateMagicBytes(bytes, ticket.type)
    )
      return error(400, "File does not match the approved upload");
    const extractedText =
      ticket.type === "application/pdf"
        ? await extractPdfText(bytes)
        : ticket.type.startsWith("text/") || ticket.type === "application/json"
          ? bytes.toString("utf8")
          : null;
    await publishImmutableUpload(ticket.path, bytes, ticket.type);
    const saved = await independentUploadReceipt(ticket, {
      url: getPublicUrl(VAULT_BUCKET, ticket.path),
      extractedText,
      sourceType: getUploadSourceType(ticket.type),
    });
    if (!saved) throw new Error("Contribution was not saved");
    return ok(saved);
  } catch (caught) {
    if (caught instanceof OwnershipChangedError)
      return error(403, "Not authorized to complete this Lore contribution");
    if (caught instanceof Error && caught.message === "CONTRIBUTION_REMOVED")
      return error(410, "This contribution was removed. The old upload cannot recreate it.");
    // A lost commit acknowledgement may still have a durable, user-bound receipt.
    try {
      const saved = await independentUploadReceipt(ticket);
      if (saved) return ok(saved);
    } catch (recovery) {
      if (recovery instanceof OwnershipChangedError)
        return error(403, "Not authorized to complete this Lore contribution");
      if (recovery instanceof Error && recovery.message === "CONTRIBUTION_REMOVED")
        return error(410, "This contribution was removed. The old upload cannot recreate it.");
    }
    return NextResponse.json(
      {
        status: "error",
        error: "Could not confirm the contribution. Retry this same upload.",
        retryCompletion: true,
      },
      { status: 503, headers },
    );
  }
}
