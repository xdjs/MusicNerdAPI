import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchRun } from "@/lib/vault/__tests__/searchRun";

const { writeArtistLink, ambiguous, belongs, contradicts } = vi.hoisted(() => ({
  writeArtistLink: vi.fn(async () => {}),
  ambiguous: vi.fn(async () => false),
  belongs: vi.fn(async () => false),
  contradicts: vi.fn(async () => false),
}));
vi.mock("@/lib/vault/writeArtistLink", () => ({ writeArtistLink }));
vi.mock("@/lib/identity/nameIsAmbiguousInDirectory", () => ({
  nameIsAmbiguousInDirectory: ambiguous,
}));
vi.mock("@/lib/identity/handleBelongsToAnotherArtist", () => ({
  handleBelongsToAnotherArtist: belongs,
}));
vi.mock("@/lib/identity/contradictsScrapedPosts", () => ({ contradictsScrapedPosts: contradicts }));
const { adoptJudgedAccount } = await import("@/lib/vault/adoptJudgedAccount");

const x = { siteName: "x", cardPlatformName: "X", id: "p3t3rango" };
beforeEach(() => {
  writeArtistLink.mockClear();
  for (const f of [ambiguous, belongs, contradicts]) f.mockReset().mockResolvedValue(false);
});

describe("adoptJudgedAccount", () => {
  it("writes an affirmed account to links and routes it out of the vault", async () => {
    const run = searchRun();
    expect(await adoptJudgedAccount(run, x, "https://x.com/p3t3rango", "about-artist")).toBe(true);
    expect(writeArtistLink).toHaveBeenCalledWith("a1", "x", "p3t3rango", undefined, run.artist);
  });

  it("never replaces a link the artist already has, and needs the judge's yes", async () => {
    const run = searchRun({ artist: { id: "a1", name: "Grimes", x: "someone" } });
    expect(await adoptJudgedAccount(run, x, "https://x.com/p3t3rango", "about-artist")).toBe(false);
    expect(await adoptJudgedAccount(searchRun(), x, "https://x.com/p3t3rango", "undecided")).toBe(
      false,
    );
    expect(writeArtistLink).not.toHaveBeenCalled();
  });

  it("applies the same identity checks as every other path", async () => {
    for (const guard of [ambiguous, belongs, contradicts]) {
      guard.mockResolvedValueOnce(true);
      expect(
        await adoptJudgedAccount(searchRun(), x, "https://x.com/p3t3rango", "about-artist"),
      ).toBe(false);
    }
    expect(writeArtistLink).not.toHaveBeenCalled();
  });

  it("still routes it out when the write fails", async () => {
    writeArtistLink.mockImplementationOnce(async () => {
      throw new Error("conflict");
    });
    expect(
      await adoptJudgedAccount(searchRun(), x, "https://x.com/p3t3rango", "about-artist"),
    ).toBe(true);
  });
});
