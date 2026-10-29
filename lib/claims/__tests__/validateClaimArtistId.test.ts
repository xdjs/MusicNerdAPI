import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateClaimArtistId } from "@/lib/claims/validateClaimArtistId";

describe("validateClaimArtistId", () => {
  it("returns a UUID unchanged", () => {
    const id = "aab92f80-f9e1-4299-aa33-7dd85c8de5d3";
    expect(validateClaimArtistId(id)).toBe(id);
  });

  it("is a 400 for anything else", async () => {
    const res = validateClaimArtistId("nope") as NextResponse;
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: "Invalid artist ID" });
  });
});
