import { describe, it, expect } from "vitest";
import { getActiveArtistOperation } from "@/lib/ownership/getActiveArtistOperation";
import { withArtistOperation } from "@/lib/ownership/withArtistOperation";

describe("getActiveArtistOperation", () => {
  it("is the running operation, whichever artist it is for", () => {
    const seen = withArtistOperation("a1", { expectedClaimId: "c1", userId: "u1" }, () =>
      getActiveArtistOperation(),
    );
    expect(seen).toEqual({ artistId: "a1", expectedClaimId: "c1", userId: "u1" });
  });

  it("is undefined outside an operation", () => {
    expect(getActiveArtistOperation()).toBeUndefined();
  });
});
