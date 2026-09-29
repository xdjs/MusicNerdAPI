import { describe, it, expect } from "vitest";
import { getArtistOperationOwnership } from "@/lib/ownership/getArtistOperationOwnership";
import { withArtistOperation } from "@/lib/ownership/withArtistOperation";

describe("withArtistOperation", () => {
  it("carries the ownership across awaits and returns the operation's result", async () => {
    const result = await withArtistOperation(
      "a1",
      { expectedClaimId: "c1", userId: "u1" },
      async () => {
        await Promise.resolve();
        return getArtistOperationOwnership("a1");
      },
    );
    expect(result).toEqual({ expectedClaimId: "c1", userId: "u1", artistId: "a1" });
  });

  it("isolates concurrent operations", async () => {
    const users = await Promise.all(
      ["first", "second"].map(userId =>
        withArtistOperation("a1", { userId, expectedClaimId: null }, async () => {
          await Promise.resolve();
          return getArtistOperationOwnership("a1")?.userId;
        }),
      ),
    );
    expect(users).toEqual(["first", "second"]);
  });

  it("leaves no context behind once the operation ends", async () => {
    await withArtistOperation("a1", { expectedClaimId: null }, async () => {});
    expect(getArtistOperationOwnership("a1")).toBeUndefined();
  });
});
