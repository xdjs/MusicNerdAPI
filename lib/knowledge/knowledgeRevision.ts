import { createHash } from "node:crypto";

/** Hashes an ordered, deliberately selected representation, not provider payloads. */
export function knowledgeRevision(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
