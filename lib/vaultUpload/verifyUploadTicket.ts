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
  if (ticket.userId !== userId) throw new Error("Invalid upload ticket");
  return ticket;
}
