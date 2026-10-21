import { describe, it, expect } from "vitest";
import { toolText } from "@/lib/mcp/toolText";

describe("toolText", () => {
  it("is one text content item holding the value as two-space JSON, not an error", () => {
    expect(toolText({ artists: [], totalResults: 0 })).toEqual({
      content: [{ type: "text", text: '{\n  "artists": [],\n  "totalResults": 0\n}' }],
    });
    expect(toolText({ a: 1 }).isError).toBeUndefined();
  });
});
