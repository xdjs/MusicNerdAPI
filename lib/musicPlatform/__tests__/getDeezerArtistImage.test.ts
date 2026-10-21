import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchDeezerArtist } = vi.hoisted(() => ({ fetchDeezerArtist: vi.fn() }));
vi.mock("@/lib/musicPlatform/fetchDeezerArtist", () => ({ fetchDeezerArtist }));
const { getDeezerArtistImage } = await import("@/lib/musicPlatform/getDeezerArtistImage");

beforeEach(() => fetchDeezerArtist.mockReset());

describe("getDeezerArtistImage", () => {
  it("returns the medium picture, the thumbnail size", async () => {
    fetchDeezerArtist.mockResolvedValueOnce({ picture_medium: "m", picture_xl: "xl" });
    expect(await getDeezerArtistImage("5")).toBe("m");
  });

  it("is null without an artist or a picture", async () => {
    fetchDeezerArtist.mockResolvedValueOnce(null);
    expect(await getDeezerArtistImage("5")).toBeNull();
    fetchDeezerArtist.mockResolvedValueOnce({ picture_medium: "" });
    expect(await getDeezerArtistImage("5")).toBeNull();
  });
});
