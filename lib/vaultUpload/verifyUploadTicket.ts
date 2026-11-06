import { timingSafeEqual } from "node:crypto";
import { uploadTicketSignature } from "@/lib/vaultUpload/uploadTicketSignature";
import type { UploadTicket } from "@/lib/vaultUpload/types";

/**
 * Checks a ticket's integrity and that it was issued to this user. Expiry is
 * left to the caller, so an expired but authentic ticket can still authorize
 * cleanup of its own staged object.
 *
 * @param value - The signed ticket string.
 * @param userId - The signed-in user.
 * @returns The ticket; throws `Invalid upload ticket` otherwise.
 */
export function verifyUploadTicket(value: string, userId: string): UploadTicket {
  const [payload, mac, extra] = value.split(".");
  if (!payload || !mac || extra !== undefined) throw new Error("Invalid upload ticket");
  const expected = Buffer.from(uploadTicketSignature(payload));
  const actual = Buffer.from(mac);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    throw new Error("Invalid upload ticket");
  const ticket = JSON.parse(Buffer.from(payload, "base64url").toString()) as UploadTicket;
  if (ticket.expectedClaimId !== null && typeof ticket.expectedClaimId !== "string")
    throw new Error("Invalid upload ticket");
  if (ticket.scope !== undefined && ticket.scope !== "contribution")
    throw new Error("Invalid upload ticket");
  if (
    ticket.scope === "contribution" &&
    (ticket.expectedClaimId !== null ||
      !ticket.sourceId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ticket.sourceId) ||
      !ticket.path.startsWith(`${ticket.artistId}/${ticket.sourceId}_`))
  )
    throw new Error("Invalid upload ticket");
  if (ticket.userId !== userId) throw new Error("Invalid upload ticket");
  return ticket;
}
