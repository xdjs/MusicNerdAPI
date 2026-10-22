import { describe, it, expect } from "vitest";
import { lockLinkReview } from "@/lib/artistLinkReview/lockLinkReview";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";
import { fakeTransaction } from "./fakeTransaction";

describe("lockLinkReview", () => {
  it("locks the artist, then shares the user's role and the claim", async () => {
    const tx = fakeTransaction([[{ id: "a1" }], [{ is_admin: false }], [{ user_id: "u1" }]]);
    await lockLinkReview(tx as never, "a1", "u1");
    const [artist, user, claim] = tx.statements();
    expect(artist.text).toBe("select id from artists where id=$1::uuid for update");
    expect(user.text).toBe("select is_admin from users where id=$1::uuid for share");
    expect(claim.text).toBe(
      "select user_id from artist_claims where artist_id=$1::uuid and status='approved' for share",
    );
  });

  it("lets an admin review an artist someone else claimed", async () => {
    const tx = fakeTransaction([[{ id: "a1" }], [{ is_admin: true }], [{ user_id: "owner" }]]);
    await expect(lockLinkReview(tx as never, "a1", "u1")).resolves.toBeUndefined();
  });

  it.each([
    ["a missing artist", [[], [{ is_admin: true }], []]],
    ["a missing user", [[{ id: "a1" }], [], [{ user_id: "u1" }]]],
    ["a non-owner", [[{ id: "a1" }], [{ is_admin: false }], [{ user_id: "owner" }]]],
    ["an unclaimed artist for a non-admin", [[{ id: "a1" }], [{ is_admin: false }], []]],
  ])("refuses %s", async (_name, results) => {
    await expect(
      lockLinkReview(fakeTransaction(results) as never, "a1", "u1"),
    ).rejects.toBeInstanceOf(OwnershipChangedError);
  });
});
