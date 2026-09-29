import { describe, it, expect, vi, beforeEach } from "vitest";

const { fetchJson } = vi.hoisted(() => ({ fetchJson: vi.fn() }));
vi.mock("@/lib/networking/fetchJson", () => ({ fetchJson }));
const { fetchDeezerArtist } = await import("@/lib/musicPlatform/fetchDeezerArtist");

beforeEach(() => {
  fetchJson.mockReset();
});

describe("fetchDeezerArtist", () => {
  it("reads the artist with a 5 s timeout", async () => {
    fetchJson.mockResolvedValueOnce({ id: 5, name: "A" });
    expect(await fetchDeezerArtist("5")).toEqual({ id: 5, name: "A" });
    expect(fetchJson).toHaveBeenCalledWith("https://api.deezer.com/artist/5", { timeoutMs: 5000 });
  });

  it("is null for a non-numeric id without calling Deezer", async () => {
    expect(await fetchDeezerArtist("abc")).toBeNull();
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it("is null for a Deezer error body or a failed request", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchJson.mockResolvedValueOnce({
      error: { type: "DataException", message: "no data", code: 800 },
    });
    expect(await fetchDeezerArtist("5")).toBeNull();
    fetchJson.mockResolvedValueOnce(null);
    expect(await fetchDeezerArtist("5")).toBeNull();
    error.mockRestore();
  });
});
