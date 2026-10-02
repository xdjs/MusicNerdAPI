import { describe, it, expect, vi, beforeEach } from "vitest";

const { getArtistById } = vi.hoisted(() => ({ getArtistById: vi.fn() }));
vi.mock("@/lib/artists/getArtistById", () => ({ getArtistById }));
const { artistNameForRun } = await import("@/lib/onboarding/artistNameForRun");

beforeEach(() => {
  getArtistById.mockReset().mockResolvedValue({ id: "a1", name: "Nova Reyes" });
});

describe("artistNameForRun", () => {
  it("reads the name once per run", async () => {
    const run = { artistId: "a1" };
    expect(await artistNameForRun(run)).toBe("Nova Reyes");
    expect(await artistNameForRun(run)).toBe("Nova Reyes");
    expect(getArtistById).toHaveBeenCalledTimes(1);
  });

  it("is empty for a nameless or missing artist", async () => {
    getArtistById.mockResolvedValueOnce(undefined);
    expect(await artistNameForRun({ artistId: "a1" })).toBe("");
  });
});
