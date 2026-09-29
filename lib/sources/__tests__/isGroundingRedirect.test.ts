import { describe, it, expect } from "vitest";
import { isGroundingRedirect } from "@/lib/sources/isGroundingRedirect";

describe("isGroundingRedirect", () => {
  it("recognises Google's expiring grounding redirects", () => {
    expect(
      isGroundingRedirect("https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc"),
    ).toBe(true);
    expect(isGroundingRedirect("https://www.discogs.com/artist/1")).toBe(false);
  });
});
