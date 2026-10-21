import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const { scoped, tx, set, where } = vi.hoisted(() => {
  const where = vi.fn(async (_condition: unknown) => {});
  const set = vi.fn((_v: unknown) => ({ where }));
  const tx = {
    query: { artists: { findFirst: vi.fn() } },
    update: vi.fn(() => ({ set })),
  };
  return {
    tx,
    set,
    where,
    scoped: vi.fn(async (_a: string, write: (t: unknown) => unknown) => write(tx)),
  };
});
vi.mock("@/lib/ownership/withScopedArtistWrite", () => ({ withScopedArtistWrite: scoped }));
const { saveArtistLinkOrder } = await import("@/lib/artistLinkOrder/saveArtistLinkOrder");

beforeEach(() => vi.clearAllMocks());

describe("saveArtistLinkOrder", () => {
  it("replaces one section's order and keeps the other, in a scoped write", async () => {
    tx.query.artists.findFirst.mockResolvedValue({
      id: "a1",
      linkOrder: { support: ["bandcamp"] },
    });
    expect(await saveArtistLinkOrder("a1", "links", ["spotify", "instagram"])).toBe(true);
    expect(scoped).toHaveBeenCalledWith("a1", expect.any(Function));
    expect(set).toHaveBeenCalledWith({
      linkOrder: { support: ["bandcamp"], links: ["spotify", "instagram"] },
    });
    const { sql, params } = new PgDialect().sqlToQuery(where.mock.calls[0][0] as never);
    expect(sql).toBe('"artists"."id" = $1');
    expect(params).toEqual(["a1"]);
  });

  it("starts from an empty order and returns false for a missing artist", async () => {
    tx.query.artists.findFirst.mockResolvedValueOnce({ id: "a1", linkOrder: null });
    await saveArtistLinkOrder("a1", "support", ["subvert"]);
    expect(set).toHaveBeenCalledWith({ linkOrder: { support: ["subvert"] } });
    tx.query.artists.findFirst.mockResolvedValueOnce(undefined);
    expect(await saveArtistLinkOrder("a1", "links", [])).toBe(false);
    expect(set).toHaveBeenCalledTimes(1);
  });
});
