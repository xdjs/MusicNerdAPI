import { describe, it, expect } from "vitest";
import { toolError } from "@/lib/mcp/toolError";

describe("toolError", () => {
  it("is compact { error, code } JSON text flagged as an error", () => {
    expect(toolError("Artist not found", "NOT_FOUND")).toEqual({
      content: [{ type: "text", text: '{"error":"Artist not found","code":"NOT_FOUND"}' }],
      isError: true,
    });
  });
});
