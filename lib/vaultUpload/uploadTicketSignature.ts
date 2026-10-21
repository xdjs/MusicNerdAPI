import { createHmac } from "node:crypto";

/**
 * The MAC over a ticket payload, keyed by the storage service-role key so no
 * extra secret is needed, with a purpose prefix so the key signs nothing else.
 *
 * @param payload - The base64url ticket payload.
 * @returns The base64url HMAC-SHA256.
 */
export function uploadTicketSignature(payload: string): string {
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "")
    .update(`lore-upload:${payload}`)
    .digest("base64url");
}
