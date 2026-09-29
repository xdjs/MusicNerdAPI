import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchRun } from "@/lib/vault/__tests__/searchRun";

const { getArtistById, propagateVerifiedHandles } = vi.hoisted(() => ({
  getArtistById: vi.fn(),
  propagateVerifiedHandles: vi.fn(async () => 0),
}));
vi.mock("@/lib/artists/getArtistById", () => ({ getArtistById }));
vi.mock("@/lib/vault/propagateVerifiedHandles", () => ({ propagateVerifiedHandles }));
const { propagateRunHandles } = await import("@/lib/vault/propagateRunHandles");

beforeEach(() => {
  getArtistById.mockReset().mockResolvedValue({ id: "a1", name: "Grimes" });
  propagateVerifiedHandles.mockClear();
});

describe("propagateRunHandles", () => {
  it("probes other platforms for the run's verified handles, from a fresh read", async () => {
    const run = searchRun({ verifiedHandles: new Set(["grimes"]), deadline: 123 });
    await propagateRunHandles(run, false);
    expect(propagateVerifiedHandles).toHaveBeenCalledWith(
      "a1",
      run.verifiedHandles,
      { id: "a1", name: "Grimes" },
      "Grimes",
      123,
    );
  });

  it("doesn't guess when MusicBrainz identified the artist outright, or with nothing verified", async () => {
    await propagateRunHandles(searchRun({ verifiedHandles: new Set(["grimes"]) }), true);
    await propagateRunHandles(searchRun(), false);
    getArtistById.mockImplementationOnce(async () => {
      throw new Error("pool");
    });
    await propagateRunHandles(searchRun({ verifiedHandles: new Set(["grimes"]) }), false);
    expect(propagateVerifiedHandles).not.toHaveBeenCalled();
  });
});
