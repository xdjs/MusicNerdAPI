import { describe, it, expect } from "vitest";
import { mcpRequestContext } from "@/lib/mcpAuth/mcpRequestContext";
import { requireMcpAuth } from "@/lib/mcpAuth/requireMcpAuth";
import { McpAuthError } from "@/lib/mcpAuth/McpAuthError";

describe("requireMcpAuth", () => {
  it("returns the apiKeyHash when inside a context", () => {
    const result = mcpRequestContext.run({ apiKeyHash: "abc123" }, () => requireMcpAuth());
    expect(result).toBe("abc123");
  });

  it("throws McpAuthError when outside a context", () => {
    expect(() => requireMcpAuth()).toThrow(McpAuthError);
  });
});
