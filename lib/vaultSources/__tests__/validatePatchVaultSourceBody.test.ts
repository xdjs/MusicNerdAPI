import { NextResponse } from "next/server";
import { describe, it, expect } from "vitest";
import { validatePatchVaultSourceBody } from "@/lib/vaultSources/validatePatchVaultSourceBody";

describe("validatePatchVaultSourceBody", () => {
  it("accepts a decision, a pending-only decision, a type, or both", () => {
    expect(validatePatchVaultSourceBody({ status: "approved" })).toEqual({ status: "approved" });
    expect(validatePatchVaultSourceBody({ status: "rejected", expectedStatus: "pending" })).toEqual(
      { status: "rejected", expectedStatus: "pending" },
    );
    expect(validatePatchVaultSourceBody({ type: "interview" })).toEqual({ type: "interview" });
    expect(validatePatchVaultSourceBody({ status: "approved", type: "review" })).toEqual({
      status: "approved",
      type: "review",
    });
  });

  it.each([
    [null],
    [{}],
    [{ status: "pending" }],
    [{ type: "podcast" }],
    [{ expectedStatus: "pending", type: "article" }],
  ])("rejects %j with a 400", async body => {
    const res = validatePatchVaultSourceBody(body) as NextResponse;
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: "Send status or type" });
  });
});
