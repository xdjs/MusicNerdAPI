import { describe, expect, it } from "vitest";
import { hashToken } from "@/lib/oauth/hashToken";

describe("hashToken", () => {
  it("is the SHA-256 hex digest, so only hashes are stored", () => {
    expect(hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
