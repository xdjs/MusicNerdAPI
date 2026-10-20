import { describe, it, expect } from "vitest";
import { hashApiKey } from "@/lib/mcpAuth/hashApiKey";

describe("hashApiKey", () => {
  it("returns a consistent SHA-256 hex digest", () => {
    const hash = hashApiKey("test-key");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApiKey("test-key")).toBe(hash);
  });

  it("returns different hashes for different keys", () => {
    expect(hashApiKey("key-a")).not.toBe(hashApiKey("key-b"));
  });
});
