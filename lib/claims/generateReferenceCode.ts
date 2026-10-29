import { randomBytes } from "node:crypto";

/** Uppercase letters and digits, without the ambiguous I, O, 0 and 1. 32 characters, so a byte maps without bias. */
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * A claim's reference code, which the claimant sends from the artist's
 * official account so an admin can match the claim. MusicNerdWeb's format.
 *
 * @returns `MN-` and four characters, e.g. `MN-7KQ4`.
 */
export function generateReferenceCode(): string {
  return `MN-${Array.from(randomBytes(4), b => CHARS[b % CHARS.length]).join("")}`;
}
