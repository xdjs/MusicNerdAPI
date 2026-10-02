import { describe, it, expect, vi, beforeEach } from "vitest";

const g = vi.hoisted(() => ({
  ambiguous: vi.fn(),
  belongs: vi.fn(),
  contradicts: vi.fn(),
  name: vi.fn(),
}));
vi.mock("@/lib/identity/nameIsAmbiguousInDirectory", () => ({
  nameIsAmbiguousInDirectory: g.ambiguous,
}));
vi.mock("@/lib/identity/handleBelongsToAnotherArtist", () => ({
  handleBelongsToAnotherArtist: g.belongs,
}));
vi.mock("@/lib/identity/contradictsScrapedPosts", () => ({
  contradictsScrapedPosts: g.contradicts,
}));
vi.mock("@/lib/onboarding/artistNameForRun", () => ({ artistNameForRun: g.name }));
const { linkIsIdentityBlocked } = await import("@/lib/onboarding/linkIsIdentityBlocked");

beforeEach(() => {
  g.ambiguous.mockReset().mockResolvedValue(false);
  g.belongs.mockReset().mockResolvedValue(false);
  g.contradicts.mockReset().mockResolvedValue(false);
  g.name.mockReset().mockResolvedValue("Black Dave");
});

describe("linkIsIdentityBlocked", () => {
  it("clears a handle all three guards pass", async () => {
    expect(await linkIsIdentityBlocked({ artistId: "a1" }, "instagram", "blackdave")).toBe(false);
    expect(g.ambiguous).toHaveBeenCalledWith("a1", "Black Dave");
    expect(g.belongs).toHaveBeenCalledWith("a1", "instagram", "blackdave");
    expect(g.contradicts).toHaveBeenCalledWith("a1", "instagram", "blackdave");
  });

  it.each(["ambiguous", "belongs", "contradicts"] as const)(
    "blocks when %s says so, and stops there",
    async key => {
      g[key].mockResolvedValueOnce(true);
      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      expect(await linkIsIdentityBlocked({ artistId: "a1" }, "x", "bd")).toBe(true);
      log.mockRestore();
    },
  );
});
