import { beforeEach, expect, it, vi } from "vitest";
import { loadCanvasPublicBio } from "../loadCanvasPublicBio";
const mocks = vi.hoisted(() => ({ artist: vi.fn(), claim: vi.fn(), about: vi.fn() }));
vi.mock("@/lib/artists/getArtistById", () => ({ getArtistById: mocks.artist }));
vi.mock("@/lib/ownership/getLoreClaimGeneration", () => ({ getLoreClaimGeneration: mocks.claim }));
vi.mock("@/lib/bio/getPublicArtistAbout", () => ({ getPublicArtistAbout: mocks.about }));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.artist.mockResolvedValue({ name: "A", bio: "Unpublished internal draft" });
});
it("does not expose an unclaimed draft bio", async () => {
  mocks.claim.mockResolvedValue(null);
  mocks.about.mockResolvedValue(null);
  expect(await loadCanvasPublicBio("artist")).toBeNull();
});
it("uses only the eligible public About for an unclaimed artist", async () => {
  mocks.claim.mockResolvedValue(null);
  mocks.about.mockResolvedValue({ bio: "Published source-backed introduction" });
  expect((await loadCanvasPublicBio("artist"))?.bio).toBe("Published source-backed introduction");
});
it("reuses the claimed public profile bio", async () => {
  mocks.claim.mockResolvedValue("approved-claim");
  mocks.artist.mockResolvedValue({ name: "A", bio: "Public claimed bio" });
  expect((await loadCanvasPublicBio("artist"))?.bio).toBe("Public claimed bio");
  expect(mocks.about).not.toHaveBeenCalled();
});
