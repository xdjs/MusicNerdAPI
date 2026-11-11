import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { assertPairedChatBundle } from "../assertPairedChatBundle";

it("rejects a missing or stale executable digest before admission", () => {
  const directory = mkdtempSync(join(tmpdir(), "pair-bundle-"));
  try {
    const path = join(directory, "pair.cjs");
    writeFileSync(path, "reviewed executable");
    const hash = createHash("sha256").update("reviewed executable").digest("hex");
    expect(() => assertPairedChatBundle(path, hash)).not.toThrow();
    const forward = vi.fn();
    for (const expected of [undefined, "", "0".repeat(64)]) {
      expect(() => {
        assertPairedChatBundle(path, expected);
        forward();
      }).toThrow();
    }
    writeFileSync(path, "stale executable");
    expect(() => {
      assertPairedChatBundle(path, hash);
      forward();
    }).toThrow("pair_bundle_pin_mismatch");
    expect(forward).not.toHaveBeenCalled();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
