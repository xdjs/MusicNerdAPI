import { uploadTicketSignature } from "@/lib/vaultUpload/uploadTicketSignature";
import type { UploadTicket } from "@/lib/vaultUpload/types";

/**
 * Serializes and signs a ticket: `<base64url payload>.<base64url MAC>`.
 *
 * @param ticket - The ticket.
 * @returns The signed ticket string the client hands back to `complete`.
 */
export function signUploadTicket(ticket: UploadTicket): string {
  const payload = Buffer.from(JSON.stringify(ticket)).toString("base64url");
  return `${payload}.${uploadTicketSignature(payload)}`;
}
