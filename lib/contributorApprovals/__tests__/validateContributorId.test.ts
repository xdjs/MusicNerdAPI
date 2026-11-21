import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateContributorId } from "@/lib/contributorApprovals/validateContributorId";

describe("validateContributorId", () => {
  it("returns a UUID", () => {
    const id = "0b1e4c2a-7f3d-4a58-9c61-2d8e5f7a9b10";
    expect(validateContributorId(id)).toBe(id);
  });

  it("rejects anything else with a 400", async () => {
    const res = validateContributorId("u1") as NextResponse;
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: "Invalid user ID" });
  });
});
