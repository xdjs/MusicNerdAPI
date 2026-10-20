import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateWhitelistUserBody } from "@/lib/whitelistUser/validateWhitelistUserBody";

const req = (body: string) => new Request("https://x", { method: "PUT", body });

describe("validateWhitelistUserBody", () => {
  it("returns the fields", async () => {
    expect(await validateWhitelistUserBody(req('{"isAdmin":true,"username":"Pete"}'))).toEqual({
      isAdmin: true,
      username: "Pete",
    });
  });

  it.each([["not json"], ['{"isAdmin":"yes"}'], ['{"wallet":5}']])("is a 400 for %s", async b => {
    const res = (await validateWhitelistUserBody(req(b))) as NextResponse;
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: "Invalid user fields" });
  });
});
