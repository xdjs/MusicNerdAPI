import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateUserId } from "@/lib/users/validateUserId";

describe("validateUserId", () => {
  it("accepts a UUID", () => {
    expect(validateUserId("9ac03b48-115a-489b-95db-d9ac15ada1b2")).toBe(
      "9ac03b48-115a-489b-95db-d9ac15ada1b2",
    );
  });

  it("rejects anything else with a CORS-enabled 400", async () => {
    const result = validateUserId("test-user-id");
    expect(result).toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) return;
    expect(result.status).toBe(400);
    expect(await result.json()).toEqual({ status: "error", error: "Invalid user ID" });
    expect(result.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
