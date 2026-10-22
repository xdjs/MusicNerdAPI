import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateLinkReviewBody } from "@/lib/artistLinkReview/validateLinkReviewBody";

const id = "6cb3d81a-3d02-4c57-a711-bb7902a9af1b";
const input = { id: "0f3a7c62-1d7e-4b1e-9a7a-5b1f0c0e2a11", kind: "source", decision: "restore" };

describe("validateLinkReviewBody", () => {
  it("returns the artist and the decision", () => {
    expect(validateLinkReviewBody(input, id)).toEqual({ artistId: id, input });
  });

  it.each([
    [input, "nope"],
    [null, id],
    [{ ...input, id: "x" }, id],
    [{ ...input, kind: "other" }, id],
    [{ ...input, decision: "delete" }, id],
  ])("400s %j for %s", async (body, artistId) => {
    const res = validateLinkReviewBody(body, artistId) as NextResponse;
    expect(res).toBeInstanceOf(NextResponse);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: "Invalid review request" });
  });
});
