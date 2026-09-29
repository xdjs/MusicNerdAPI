import { describe, it, expect, vi } from "vitest";
import { authorizeLockedArtistWrite } from "@/lib/ownership/authorizeLockedArtistWrite";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

function tx(claim: unknown, user: unknown = undefined) {
  return {
    query: {
      artistClaims: { findFirst: vi.fn(async () => claim) },
      users: { findFirst: vi.fn(async () => user) },
    },
  } as never;
}

describe("authorizeLockedArtistWrite", () => {
  it("allows the claimant under the claim the operation started with", async () => {
    await expect(
      authorizeLockedArtistWrite(tx({ id: "c1", userId: "owner" }), "a1", {
        userId: "owner",
        expectedClaimId: "c1",
      }),
    ).resolves.toBeUndefined();
  });

  it("rejects when the claim disappeared or was replaced", async () => {
    for (const claim of [undefined, { id: "c2", userId: "owner" }]) {
      await expect(
        authorizeLockedArtistWrite(tx(claim), "a1", { userId: "owner", expectedClaimId: "c1" }),
      ).rejects.toBeInstanceOf(OwnershipChangedError);
    }
  });

  it("allows an admin who isn't the claimant, and rejects anyone else", async () => {
    await expect(
      authorizeLockedArtistWrite(tx({ id: "c1", userId: "owner" }, { isAdmin: true }), "a1", {
        userId: "admin",
        expectedClaimId: "c1",
      }),
    ).resolves.toBeUndefined();
    await expect(
      authorizeLockedArtistWrite(tx(null, { isAdmin: false }), "a1", {
        userId: "former-admin",
        expectedClaimId: null,
      }),
    ).rejects.toThrow("ownership changed");
  });
});
