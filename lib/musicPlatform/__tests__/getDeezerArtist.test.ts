import { describe, it, expect, vi, beforeEach } from "vitest";

const { fetchDeezerArtist, fetchDeezerTopTrack } = vi.hoisted(() => ({
  fetchDeezerArtist: vi.fn(),
  fetchDeezerTopTrack: vi.fn(),
}));
vi.mock("@/lib/musicPlatform/fetchDeezerArtist", () => ({ fetchDeezerArtist }));
vi.mock("@/lib/musicPlatform/fetchDeezerTopTrack", () => ({ fetchDeezerTopTrack }));
const { getDeezerArtist } = await import("@/lib/musicPlatform/getDeezerArtist");

beforeEach(() => {
  fetchDeezerArtist.mockReset();
  fetchDeezerTopTrack.mockReset();
});

describe("getDeezerArtist", () => {
  it("maps the artist with its top track", async () => {
    fetchDeezerArtist.mockResolvedValueOnce({
      id: 5,
      name: "A",
      link: "l",
      picture_medium: "m",
      picture_xl: "xl",
      nb_fan: 1,
      nb_album: 2,
    });
    fetchDeezerTopTrack.mockResolvedValueOnce("Hit");
    expect(await getDeezerArtist("5")).toMatchObject({
      platform: "deezer",
      platformId: "5",
      topTrackName: "Hit",
    });
  });

  it("is null when the artist can't be read", async () => {
    fetchDeezerArtist.mockResolvedValueOnce(null);
    fetchDeezerTopTrack.mockResolvedValueOnce("Hit");
    expect(await getDeezerArtist("5")).toBeNull();
  });
});
