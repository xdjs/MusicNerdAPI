import { describe, it, expect, vi, beforeEach } from "vitest";

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { query: { artistVaultSources: { findFirst } } } }));
const { getVaultSourceByIdAndArtist } = await import("@/lib/vault/getVaultSourceByIdAndArtist");

beforeEach(() => {
  findFirst.mockReset();
});

describe("getVaultSourceByIdAndArtist", () => {
  it("returns the source only when it belongs to the artist", async () => {
    findFirst.mockResolvedValueOnce({ id: "s1", artistId: "a1" });
    expect(await getVaultSourceByIdAndArtist("s1", "a1")).toEqual({ id: "s1", artistId: "a1" });
    expect(findFirst).toHaveBeenCalledWith({ where: expect.anything() });
  });

  it("is undefined on a database error", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    findFirst.mockImplementationOnce(async () => {
      throw new Error("pool");
    });
    expect(await getVaultSourceByIdAndArtist("s1", "a1")).toBeUndefined();
    error.mockRestore();
  });
});
