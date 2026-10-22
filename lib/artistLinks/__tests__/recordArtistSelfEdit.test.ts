import { describe, it, expect, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { recordArtistSelfEdit } from "@/lib/artistLinks/recordArtistSelfEdit";
import { withArtistOperation } from "@/lib/ownership/withArtistOperation";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

function transaction(claim: { user_id: string } | undefined, user?: { isAdmin: boolean }) {
  const values = vi.fn(async () => {});
  return {
    execute: vi.fn(async (_q: SQL) => (claim ? [claim] : [])),
    query: { users: { findFirst: vi.fn(async () => user) } },
    insert: vi.fn(() => ({ values })),
    values,
  };
}
const asClaimant = <T>(run: () => T) =>
  withArtistOperation("a1", { userId: "u1", expectedClaimId: "c1" }, run);

describe("recordArtistSelfEdit", () => {
  it("records the claimant's changed link after re-reading the claim", async () => {
    const tx = transaction({ user_id: "u1" });
    await asClaimant(() =>
      recordArtistSelfEdit(tx as never, "a1", "instagram", "old", "new", "https://ig/new"),
    );
    const { text, params } = renderSql(tx.execute.mock.calls[0][0]);
    expect(text).toContain("FROM artist_claims WHERE id = $1::uuid AND artist_id = $2::uuid");
    expect(text).toContain("status = 'approved'");
    expect(params).toEqual(["c1", "a1"]);
    expect(tx.values).toHaveBeenCalledWith({
      artistId: "a1",
      userId: "u1",
      siteName: "instagram",
      oldValue: "old",
      newValue: "new",
      submittedUrl: "https://ig/new",
    });
  });

  it("records nothing outside a claimed operation or for an unchanged value", async () => {
    const tx = transaction({ user_id: "u1" });
    await recordArtistSelfEdit(tx as never, "a1", "x", "a", "b", "u");
    await withArtistOperation("a1", { userId: "u1", expectedClaimId: null }, () =>
      recordArtistSelfEdit(tx as never, "a1", "x", "a", "b", "u"),
    );
    await asClaimant(() => recordArtistSelfEdit(tx as never, "a1", "x", "same", "same", "u"));
    expect(tx.execute).not.toHaveBeenCalled();
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("records nothing for an admin editing someone else's artist", async () => {
    const tx = transaction({ user_id: "owner" }, { isAdmin: true });
    await asClaimant(() => recordArtistSelfEdit(tx as never, "a1", "x", "a", "b", "u"));
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("cancels when the claim is gone or the user is neither claimant nor admin", async () => {
    await expect(
      asClaimant(() =>
        recordArtistSelfEdit(transaction(undefined) as never, "a1", "x", "a", "b", "u"),
      ),
    ).rejects.toBeInstanceOf(OwnershipChangedError);
    await expect(
      asClaimant(() =>
        recordArtistSelfEdit(
          transaction({ user_id: "owner" }, { isAdmin: false }) as never,
          "a1",
          "x",
          "a",
          "b",
          "u",
        ),
      ),
    ).rejects.toBeInstanceOf(OwnershipChangedError);
  });
});
