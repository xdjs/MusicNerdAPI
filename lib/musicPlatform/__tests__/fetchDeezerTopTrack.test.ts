import { describe, it, expect, vi, beforeEach } from "vitest";

const { fetchJson } = vi.hoisted(() => ({ fetchJson: vi.fn() }));
vi.mock("@/lib/networking/fetchJson", () => ({ fetchJson }));
const { fetchDeezerTopTrack } = await import("@/lib/musicPlatform/fetchDeezerTopTrack");

beforeEach(() => {
  fetchJson.mockReset();
});

describe("fetchDeezerTopTrack", () => {
  it("returns the top track's title", async () => {
    fetchJson.mockResolvedValueOnce({ data: [{ id: 1, title: "Hit" }] });
    expect(await fetchDeezerTopTrack("5")).toBe("Hit");
    expect(fetchJson).toHaveBeenCalledWith("https://api.deezer.com/artist/5/top?limit=1", {
      timeoutMs: 5000,
    });
  });

  it("is null with no tracks, an error body, a failure or a bad id", async () => {
    fetchJson.mockResolvedValueOnce({ data: [] });
    expect(await fetchDeezerTopTrack("5")).toBeNull();
    fetchJson.mockResolvedValueOnce({ error: { type: "x", message: "y" } });
    expect(await fetchDeezerTopTrack("5")).toBeNull();
    fetchJson.mockResolvedValueOnce(null);
    expect(await fetchDeezerTopTrack("5")).toBeNull();
    expect(await fetchDeezerTopTrack("x")).toBeNull();
  });
});
