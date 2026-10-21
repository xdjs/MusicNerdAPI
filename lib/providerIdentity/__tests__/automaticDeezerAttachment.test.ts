import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { applyProfileLinkDecisions } from "@/lib/onboarding/applyProfileLinkDecisions";
const m = vi.hoisted(() => ({
  artist: vi.fn(),
  set: vi.fn(),
  ambiguous: vi.fn(),
  belongs: vi.fn(),
}));
vi.mock("@/lib/artists/getArtistById", () => ({ getArtistById: m.artist }));
vi.mock("@/lib/artistLinks/setArtistLink", () => ({ setArtistLink: m.set }));
vi.mock("@/lib/artistLinks/clearArtistLink", () => ({ clearArtistLink: vi.fn() }));
vi.mock("@/lib/artists/extractArtistId", () => ({
  extractArtistId: async () => ({ siteName: "deezer", id: "87797542" }),
}));
vi.mock("@/lib/onboarding/routeLinkToVault", () => ({ routeLinkToVault: vi.fn() }));
vi.mock("@/lib/identity/nameIsAmbiguousInDirectory", () => ({
  nameIsAmbiguousInDirectory: m.ambiguous,
}));
vi.mock("@/lib/identity/handleBelongsToAnotherArtist", () => ({
  handleBelongsToAnotherArtist: m.belongs,
}));
vi.mock("@/lib/identity/contradictsScrapedPosts", () => ({
  contradictsScrapedPosts: async () => false,
}));
const url = "https://www.deezer.com/artist/87797542";
const spotify = "A".repeat(22);
const apply = (automatic = true) =>
  applyProfileLinkDecisions(
    "rnd1",
    [{ url }],
    [],
    automatic ? { verifyIdentity: true } : undefined,
  );
beforeEach(() => {
  vi.clearAllMocks();
  m.artist.mockResolvedValue({ name: "Rnd1", spotify });
  m.ambiguous.mockResolvedValue(false);
  m.belongs.mockResolvedValue(false);
  m.set.mockResolvedValue({ oldValue: null });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: { bindings: [] } }) }),
  );
});
afterEach(() => vi.unstubAllGlobals());
it("does not automatically attach the RNDN candidate without independent pair evidence", async () => {
  expect((await apply()).identityBlocked).toEqual([url]);
  expect(m.set).not.toHaveBeenCalled();
});
it("retains explicit artist confirmation of a different-name alias (synthetic authority fixture)", async () => {
  expect((await apply(false)).written).toEqual(["deezer"]);
  expect(m.set).toHaveBeenCalledWith("rnd1", "deezer", "87797542");
  expect(fetch).not.toHaveBeenCalled();
});
it("automatically accepts a corroborated exact pair regardless of the display name (synthetic alias)", async () => {
  m.artist.mockResolvedValue({ name: "Synthetic stage alias", spotify });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: {
          bindings: [
            {
              item: { value: "https://www.wikidata.org/entity/Q1" },
              sourceId: { value: spotify },
              targetId: { value: "87797542" },
            },
          ],
        },
      }),
    }),
  );
  expect((await apply()).written).toEqual(["deezer"]);
  expect(m.set).toHaveBeenCalledWith("rnd1", "deezer", "87797542", undefined, undefined, {
    spotifyId: spotify,
    deezerId: "87797542",
    previousDeezerId: null,
  });
});
it("keeps collision guards ahead of corroboration", async () => {
  m.belongs.mockResolvedValue(true);
  expect((await apply()).identityBlocked).toEqual([url]);
  expect(fetch).not.toHaveBeenCalled();
  expect(m.set).not.toHaveBeenCalled();
});
it("keeps the shared writer's collision rejection on explicit confirmation", async () => {
  m.set.mockRejectedValueOnce(new Error("identity collision"));
  expect((await apply(false)).writeRejected).toEqual([url]);
});
it("fails closed on unavailable artist data", async () => {
  m.artist.mockResolvedValue(undefined);
  expect((await apply()).identityBlocked).toEqual([url]);
  expect(fetch).not.toHaveBeenCalled();
});

it("preserves a different Deezer connection added after discovery but before verification", async () => {
  m.artist.mockResolvedValue({ name: "Rnd1", spotify, deezer: "owner-choice" });
  expect((await apply()).identityBlocked).toEqual([url]);
  expect(fetch).not.toHaveBeenCalled();
  expect(m.set).not.toHaveBeenCalled();
});
it("does not write on a reciprocal lookup outage", async () => {
  vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
  expect((await apply()).identityBlocked).toEqual([url]);
  expect(m.set).not.toHaveBeenCalled();
});
