import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST, OPTIONS } from "@/app/api/searchArtists/route";
import { searchArtistsCache } from "@/lib/artistSearch/const";
import { ProviderIdentityConflictError } from "@/lib/artistSearch/ProviderIdentityConflictError";
import { ProviderSearchUnavailableError } from "@/lib/artistSearch/ProviderSearchUnavailableError";
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
const explicit = "spotify:artist:7DRT8Nq9pZ9HuwZTSS7L8v";
const post = (query: string) =>
  POST(
    new Request("https://api.test/api/searchArtists", {
      method: "POST",
      body: JSON.stringify({ query }),
    }),
  );
beforeEach(() => {
  vi.resetAllMocks();
  searchArtistsCache.clear();
  exact.mockResolvedValue([]);
  names.mockResolvedValue([]);
  provider.mockResolvedValue(null);
});
describe("provider search public route", () => {
  it("rejects invalid URLs with 400 before reads", async () => {
    const response = await post("https://example.test/artist/123");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Use a Spotify or Deezer artist link or ID." });
    expect(exact).not.toHaveBeenCalled();
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(searchArtistsCache.size).toBe(0);
  });
  it("reports conflicts as 409 without provider fallback", async () => {
    exact.mockRejectedValue(new ProviderIdentityConflictError());
    const response = await post(explicit);
    expect(response.status).toBe(409);
    expect(provider).not.toHaveBeenCalled();
    expect(searchArtistsCache.size).toBe(0);
  });
  it("returns explicit provider failure as uncached 503 and recovers on retry", async () => {
    provider
      .mockRejectedValueOnce(new ProviderSearchUnavailableError("spotify"))
      .mockResolvedValueOnce({
        id: null,
        name: "Recovered",
        platform: "spotify",
        platformId: "7DRT8Nq9pZ9HuwZTSS7L8v",
        isExternalOnly: true,
      });
    expect((await post(explicit)).status).toBe(503);
    expect(searchArtistsCache.size).toBe(0);
    const retry = await post(explicit);
    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({ results: [{ name: "Recovered" }] });
    expect(provider).toHaveBeenCalledTimes(2);
  });
  it("keeps numeric name matches on direct failure without caching the partial result", async () => {
    provider.mockRejectedValue(new ProviderSearchUnavailableError("deezer"));
    names.mockResolvedValue([
      { id: "name", name: "1975", isExternalOnly: false },
      {
        id: null,
        name: "1975 Ensemble",
        isExternalOnly: true,
        platform: "deezer",
        platformId: "555",
      },
    ]);
    const response = await post("1975");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      results: [{ name: "1975" }, { name: "1975 Ensemble" }],
    });
    expect(searchArtistsCache.size).toBe(0);
  });
  it("retains public preflight", () => {
    const response = OPTIONS();
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
