import { beforeEach, describe, expect, it, vi } from "vitest";
import { searchArtists } from "@/lib/artistSearch/searchArtists";
import { ProviderIdentityConflictError } from "@/lib/artistSearch/ProviderIdentityConflictError";
const { exact, names, provider } = vi.hoisted(() => ({
  exact: vi.fn(),
  names: vi.fn(),
  provider: vi.fn(),
}));
vi.mock("@/lib/artistSearch/searchForArtistByProviderId", () => ({
  searchForArtistByProviderId: exact,
}));
vi.mock("@/lib/artistSearch/searchArtistsByName", () => ({ searchArtistsByName: names }));
vi.mock("@/lib/artistSearch/fetchProviderSearchArtist", () => ({
  fetchProviderSearchArtist: provider,
}));
const id = "7DRT8Nq9pZ9HuwZTSS7L8v";
const local = {
  id: "saved",
  name: "Saved",
  spotify: id,
  deezer: "2020",
  customImage: "https://cdn.test/image",
  isExternalOnly: false,
};
const external = {
  id: null,
  platform: "deezer",
  platformId: "555",
  name: "1975 Ensemble",
  isExternalOnly: true,
};
beforeEach(() => {
  vi.resetAllMocks();
  exact.mockResolvedValue([]);
  names.mockResolvedValue([]);
  provider.mockResolvedValue(null);
});
describe("provider-ID search dispatch", () => {
  it("preserves the normal name pipeline", async () => {
    names.mockResolvedValue([local]);
    expect(await searchArtists("re:plus", ["saved"])).toEqual([local]);
    expect(names).toHaveBeenCalledWith("re:plus", ["saved"]);
    expect(exact).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
  });
  it.each([`spotify:artist:${id}`, "https://www.deezer.com/artist/2020"])(
    "resolves saved explicit input without provider/name calls: %s",
    async query => {
      exact.mockResolvedValue([local]);
      const result = await searchArtists(query, []);
      expect(result).toMatchObject([
        { id: "saved", bio: null, isExternalOnly: false, imageUrl: "https://cdn.test/image" },
      ]);
      expect(provider).not.toHaveBeenCalled();
      expect(names).not.toHaveBeenCalled();
    },
  );
  it("retains full ranked names after saved numeric identity, deduplicating saved and external identity", async () => {
    exact.mockResolvedValue([local]);
    names.mockResolvedValue([local, external, { ...external, platformId: "2020" }]);
    expect((await searchArtists("2020", [])).map(x => x.name)).toEqual(["Saved", "1975 Ensemble"]);
    expect(names).toHaveBeenCalledWith("2020", []);
    expect(provider).not.toHaveBeenCalled();
  });
  it("keeps saved identity if name search fails", async () => {
    exact.mockResolvedValue([local]);
    names.mockRejectedValue(new Error("names down"));
    expect(await searchArtists("2020", [])).toMatchObject([{ id: "saved" }]);
  });
  it("keeps successful local/external numeric names if direct lookup fails", async () => {
    names.mockResolvedValue([local, external]);
    provider.mockRejectedValue(new Error("provider down"));
    expect(await searchArtists("1975", [])).toEqual([local, external]);
  });
  it("propagates direct failure when bare input has no usable names", async () => {
    provider.mockRejectedValue(new Error("provider down"));
    await expect(searchArtists("1975", [])).rejects.toThrow("provider down");
  });
  it("propagates explicit failure without calling names", async () => {
    provider.mockRejectedValue(new Error("provider down"));
    await expect(searchArtists(`spotify:artist:${id}`, [])).rejects.toThrow("provider down");
    expect(names).not.toHaveBeenCalled();
  });
  it("retains direct artist if name search fails", async () => {
    provider.mockResolvedValue(external);
    names.mockRejectedValue(new Error("names down"));
    expect(await searchArtists("1975", [])).toEqual([external]);
  });
  it("returns external identity ahead of names without attaching namesakes", async () => {
    provider.mockResolvedValue(external);
    names.mockResolvedValue([local]);
    expect(await searchArtists("1975", [])).toEqual([external, local]);
  });
  it("does not duplicate direct external identity returned by names", async () => {
    const direct = { ...external, platformId: "1975" };
    provider.mockResolvedValue(direct);
    names.mockResolvedValue([direct, local]);
    expect(await searchArtists("1975", [])).toEqual([direct, local]);
  });
  it("prefers local name result already owning the direct identity", async () => {
    provider.mockResolvedValue({ ...external, platformId: "2020" });
    names.mockResolvedValue([local]);
    expect(await searchArtists("2020", [])).toEqual([local]);
  });
  it("returns confirmed missing explicit identity without name guessing", async () => {
    expect(await searchArtists(`spotify:artist:${id}`, [])).toEqual([]);
    expect(names).not.toHaveBeenCalled();
  });
  it("reports contradictory ownership before external fallback", async () => {
    exact.mockRejectedValue(new ProviderIdentityConflictError());
    await expect(searchArtists("1975", [])).rejects.toThrow("conflicting saved profiles");
    expect(names).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
  });
  it("rejects invalid links before any source read", async () => {
    await expect(searchArtists(`https://open.spotify.com/track/${id}`, [])).rejects.toThrow();
    expect(exact).not.toHaveBeenCalled();
    expect(names).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
  });
});
