import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";

const { authorize } = vi.hoisted(() => ({ authorize: vi.fn() }));
vi.mock("@/lib/ownership/authorizeLockedArtistWrite", () => ({
  authorizeLockedArtistWrite: authorize,
}));
const { lockScopedArtistWrite } = await import("@/lib/ownership/lockScopedArtistWrite");
const { withArtistOperation } = await import("@/lib/ownership/withArtistOperation");

function tx(claim: unknown = { id: "c1" }) {
  return {
    execute: vi.fn(async (_query: SQL) => []),
    query: { artistClaims: { findFirst: vi.fn(async () => claim) } },
  };
}

beforeEach(() => authorize.mockReset().mockResolvedValue(undefined));

describe("lockScopedArtistWrite", () => {
  it("does nothing outside an operation", async () => {
    const t = tx();
    await lockScopedArtistWrite(t as never, "a1");
    expect(t.execute).not.toHaveBeenCalled();
  });

  it("locks the artist row, then authorizes the operation's user", async () => {
    const t = tx();
    await withArtistOperation("a1", { userId: "admin", expectedClaimId: "c1" }, () =>
      lockScopedArtistWrite(t as never, "a1"),
    );
    expect(renderSql(t.execute.mock.calls[0][0]).text).toBe(
      "select id from artists where id = $1::uuid for update",
    );
    expect(authorize).toHaveBeenCalledWith(t, "a1", { userId: "admin", expectedClaimId: "c1" });
  });

  it("without a user, only checks the claim generation", async () => {
    const ok = tx({ id: "c1" });
    await withArtistOperation("a1", { expectedClaimId: "c1" }, () =>
      lockScopedArtistWrite(ok as never, "a1"),
    );
    expect(authorize).not.toHaveBeenCalled();
    const changed = tx(null);
    await expect(
      withArtistOperation("a1", { expectedClaimId: "c1" }, () =>
        lockScopedArtistWrite(changed as never, "a1"),
      ),
    ).rejects.toThrow("ownership changed");
  });
});
