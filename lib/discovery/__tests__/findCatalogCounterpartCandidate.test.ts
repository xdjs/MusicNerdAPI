import { expect, it, vi } from "vitest";
import { findDeezerCandidate } from "../findDeezerCandidate";
import { findCatalogCounterpartCandidate } from "../findCatalogCounterpartCandidate";
const resolve = vi.hoisted(() => vi.fn());
vi.mock("@/lib/musicPlatform/resolveCatalogCounterpart", () => ({
  resolveCatalogCounterpart: resolve,
}));
it("routes Spotify-backed Deezer discovery through recording evidence", async () => {
  resolve.mockResolvedValue({ status: "verified", spotifyId: "S", deezerId: "42", recordings: 2 });
  expect(await findDeezerCandidate("Pete Rango", { spotify: "S" })).toMatchObject({
    platform: "deezer",
    url: "https://www.deezer.com/artist/42",
  });
  expect(resolve).toHaveBeenCalledWith({ artistName: "Pete Rango", spotifyId: "S" });
});
it("keeps unresolved and failed counterparts out of proposed links", async () => {
  for (const status of ["not_found", "ambiguous", "provider_failure"]) {
    resolve.mockResolvedValue({ status });
    expect(await findCatalogCounterpartCandidate("Pete Rango", "deezer", "S")).toBeNull();
  }
});
