import { describe, it, expect } from "vitest";
import { getArtistOperationOwnership } from "@/lib/ownership/getArtistOperationOwnership";
import { withArtistOperation } from "@/lib/ownership/withArtistOperation";

describe("getArtistOperationOwnership", () => {
  it("is undefined outside an operation", () => {
    expect(getArtistOperationOwnership("a1")).toBeUndefined();
  });

  it("refuses a write for a different artist than the operation's", async () => {
    await expect(
      withArtistOperation("a1", { expectedClaimId: null }, async () =>
        getArtistOperationOwnership("another"),
      ),
    ).rejects.toThrow("Artist operation scope mismatch");
  });
});
