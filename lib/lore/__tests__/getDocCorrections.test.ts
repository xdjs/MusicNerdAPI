import { describe, it, expect, vi, beforeEach } from "vitest";

const where = vi.fn();
vi.mock("@/lib/db/db", () => ({
  db: { select: () => ({ from: () => ({ where: (...a: unknown[]) => where(...a) }) }) },
}));
const { getDocCorrections } = await import("@/lib/lore/getDocCorrections");

beforeEach(() => where.mockReset());

describe("getDocCorrections", () => {
  it("returns the artist's corrections in the shape the prompt reads", async () => {
    where.mockResolvedValueOnce([
      { id: "c1", artistId: "a1", claim: "x", correction: null, kind: "wrong", extra: 1 },
    ]);
    expect(await getDocCorrections("a1")).toEqual([
      { id: "c1", claim: "x", correction: null, kind: "wrong" },
    ]);
  });

  it("returns [] on a database error, so the Lore still builds", async () => {
    where.mockImplementationOnce(async () => {
      throw new Error("pool");
    });
    expect(await getDocCorrections("a1")).toEqual([]);
  });
});
