import { describe, it, expect } from "vitest";
import { hashApiKey } from "@/lib/mcpAuth/hashApiKey";

describe("hashApiKey", () => {
  it("is a stable 64-character SHA-256 hex digest", () => {
    expect(hashApiKey("test-key")).toBe(hashApiKey("test-key"));
    expect(hashApiKey("test-key")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApiKey("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("differs for different keys", () => {
    expect(hashApiKey("key-a")).not.toBe(hashApiKey("key-b"));
  });
});
