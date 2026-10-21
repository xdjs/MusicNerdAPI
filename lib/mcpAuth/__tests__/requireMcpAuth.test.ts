import { describe, it, expect } from "vitest";
import { McpAuthError } from "@/lib/mcpAuth/McpAuthError";
import { mcpRequestContext } from "@/lib/mcpAuth/mcpRequestContext";
import { requireMcpAuth } from "@/lib/mcpAuth/requireMcpAuth";

describe("requireMcpAuth", () => {
  it("returns the hash from the request context", () => {
    expect(mcpRequestContext.run({ apiKeyHash: "test-hash-123" }, () => requireMcpAuth())).toBe(
      "test-hash-123",
    );
  });

  it("throws McpAuthError outside an authenticated request", () => {
    expect(() => requireMcpAuth()).toThrow("Authentication required");
    expect(() => requireMcpAuth()).toThrow(McpAuthError);
  });

  it("keeps the context across async hops", async () => {
    const result = await mcpRequestContext.run({ apiKeyHash: "async-hash" }, async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
      return requireMcpAuth();
    });
    expect(result).toBe("async-hash");
  });
});
