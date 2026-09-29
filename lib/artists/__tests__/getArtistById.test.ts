import { describe, it, expect, vi, beforeEach } from "vitest";

const findFirst = vi.fn();
vi.mock("@/lib/db/db", () => ({
  db: { query: { artists: { findFirst: (...a: unknown[]) => findFirst(...a) } } },
}));
const { getArtistById } = await import("@/lib/artists/getArtistById");

beforeEach(() => findFirst.mockReset());

describe("getArtistById", () => {
  it("returns the full row, or undefined when there is none", async () => {
    findFirst.mockResolvedValueOnce({ id: "a1", name: "Pete Rango" });
    expect(await getArtistById("a1")).toEqual({ id: "a1", name: "Pete Rango" });
    findFirst.mockResolvedValueOnce(undefined);
    expect(await getArtistById("a2")).toBeUndefined();
  });

  it("throws on a database error, so callers can tell it from a missing artist", async () => {
    findFirst.mockImplementationOnce(async () => {
      throw new Error("pool");
    });
    await expect(getArtistById("a1")).rejects.toThrow("Error fetching artist by Id");
  });
});
