import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

/** Validate the actual executable artifact against an independently reviewed digest. */
export function assertPairedChatBundle(path: string, expected: string | undefined) {
  if (!expected || !/^[a-f0-9]{64}$/.test(expected)) throw new Error("pair_bundle_pin_missing");
  if (createHash("sha256").update(readFileSync(path)).digest("hex") !== expected)
    throw new Error("pair_bundle_pin_mismatch");
}
