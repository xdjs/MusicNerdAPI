import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateMcpKeyId } from "@/lib/mcpKeys/validateMcpKeyId";

describe("validateMcpKeyId", () => {
  it("accepts a UUID", () => {
    expect(validateMcpKeyId("f03cf36d-ca06-43db-9fd1-a4b73c636bd7")).toBe(
      "f03cf36d-ca06-43db-9fd1-a4b73c636bd7",
    );
  });

  it("rejects anything else with a CORS-enabled 400", async () => {
    const result = validateMcpKeyId("not-a-key");
    expect(result).toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) return;
    expect(result.status).toBe(400);
    expect(await result.json()).toEqual({ status: "error", error: "Invalid key ID" });
    expect(result.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
