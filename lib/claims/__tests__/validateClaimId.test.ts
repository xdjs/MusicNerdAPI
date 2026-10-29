import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateClaimId } from "@/lib/claims/validateClaimId";

describe("validateClaimId", () => {
  it("returns a UUID unchanged", () => {
    const id = "3c0b6f9e-2d4a-4e8b-9f1c-5a7d2e6b8c41";
    expect(validateClaimId(id)).toBe(id);
  });

  it("is a 400 for anything else", async () => {
    const res = validateClaimId("nope") as NextResponse;
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: "Invalid claim ID" });
  });
});
