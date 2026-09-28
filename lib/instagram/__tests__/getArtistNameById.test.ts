import { describe, it, expect, vi, beforeEach } from "vitest";

const findFirst = vi.fn();
vi.mock("@/lib/db/db", () => ({
  db: { query: { artists: { findFirst: (...a: unknown[]) => findFirst(...a) } } },
}));
const { getArtistNameById } = await import("@/lib/instagram/getArtistNameById");

beforeEach(() => findFirst.mockReset());

describe("getArtistNameById", () => {
  it("returns the name, or undefined when missing or on error", async () => {
    findFirst.mockResolvedValueOnce({ name: "Bio Ritmo" });
    expect(await getArtistNameById("a")).toBe("Bio Ritmo");
    findFirst.mockResolvedValueOnce(undefined);
    expect(await getArtistNameById("a")).toBeUndefined();
    findFirst.mockImplementationOnce(async () => {
      throw new Error("pool");
    });
    expect(await getArtistNameById("a")).toBeUndefined();
  });
});
