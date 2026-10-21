import { describe, it, expect, vi, beforeEach } from "vitest";
import { ABOUT_EMPTY_STATE } from "@/lib/bio/const";
import { artistRow } from "@/lib/mcp/__tests__/artistRow";

const { getArtistLinks, findApprovedClaim, getPublicArtistAbout } = vi.hoisted(() => ({
  getArtistLinks: vi.fn(async (_a: unknown): Promise<unknown[]> => []),
  findApprovedClaim: vi.fn(async (_db: unknown, _id: string): Promise<unknown> => undefined),
  getPublicArtistAbout: vi.fn(async (_id: string): Promise<unknown> => null),
}));
vi.mock("@/lib/db/db", () => ({ db: {} }));
vi.mock("@/lib/artists/getArtistLinks", () => ({ getArtistLinks }));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({ findApprovedClaim }));
vi.mock("@/lib/bio/getPublicArtistAbout", () => ({ getPublicArtistAbout }));
const { toArtistDetail } = await import("@/lib/mcp/toArtistDetail");

const link = (siteName: string, artistUrl: string) => ({
  id: "l",
  siteName,
  appStringFormat: "",
  order: 1,
  cardPlatformName: null,
  regex: "",
  siteImage: null,
  colorHex: null,
  artistUrl,
});

beforeEach(() => {
  vi.clearAllMocks();
  findApprovedClaim.mockResolvedValue(undefined);
  getPublicArtistAbout.mockResolvedValue(null);
  getArtistLinks.mockResolvedValue([]);
});

describe("toArtistDetail", () => {
  it("keys socialLinks by siteName with the artist's handle and the link URL", async () => {
    const artist = artistRow({
      id: "a1",
      name: "Social Artist",
      spotify: "spotify456",
      instagram: "socialartist",
      x: "socialartist_x",
    });
    getArtistLinks.mockResolvedValue([
      link("spotify", "https://open.spotify.com/artist/spotify456"),
      link("instagram", "https://instagram.com/socialartist"),
      link("x", "https://twitter.com/socialartist_x"),
    ]);
    const result = await toArtistDetail(artist);
    expect(getArtistLinks).toHaveBeenCalledWith(artist);
    expect(result).toEqual({
      id: "a1",
      name: "Social Artist",
      bio: null,
      spotifyId: "spotify456",
      deezerId: null,
      socialLinks: {
        spotify: { handle: "spotify456", url: "https://open.spotify.com/artist/spotify456" },
        instagram: { handle: "socialartist", url: "https://instagram.com/socialartist" },
        x: { handle: "socialartist_x", url: "https://twitter.com/socialartist_x" },
      },
    });
  });

  it("reads the facebookID handle from facebookId and strips @ from YouTube handles", async () => {
    getArtistLinks.mockResolvedValue([
      link("facebookID", "https://facebook.com/123"),
      link("youtube", "https://youtube.com/@legacyhandle"),
      link("youtubechannel", "https://youtube.com/@legacychannel"),
    ]);
    const result = await toArtistDetail(
      artistRow({
        facebookId: "https://facebook.com/123",
        youtube: "@legacyhandle",
        youtubechannel: "@legacychannel",
      }),
    );
    expect(result.socialLinks.facebookID.handle).toBe("https://facebook.com/123");
    expect(result.socialLinks.youtube.handle).toBe("legacyhandle");
    expect(result.socialLinks.youtubechannel.handle).toBe("legacychannel");
  });

  it("passes a YouTube handle without @ through, and an empty link set gives {}", async () => {
    getArtistLinks.mockResolvedValue([link("youtube", "https://youtube.com/@cleanhandle")]);
    expect(
      (await toArtistDetail(artistRow({ youtube: "cleanhandle" }))).socialLinks.youtube.handle,
    ).toBe("cleanhandle");
    getArtistLinks.mockResolvedValue([]);
    expect((await toArtistDetail(artistRow())).socialLinks).toEqual({});
  });

  it("returns a claimed artist's real bio and never asks the directory", async () => {
    findApprovedClaim.mockResolvedValue({ id: "claim" });
    const result = await toArtistDetail(artistRow({ bio: "Artist biography here" }));
    expect(result.bio).toBe("Artist biography here");
    expect(getPublicArtistAbout).not.toHaveBeenCalled();
  });

  it("returns null for a claimed artist whose bio is the claim nudge, without asking the directory", async () => {
    findApprovedClaim.mockResolvedValue({ id: "claim" });
    expect((await toArtistDetail(artistRow({ bio: ABOUT_EMPTY_STATE }))).bio).toBeNull();
    expect(getPublicArtistAbout).not.toHaveBeenCalled();
  });

  it("returns the directory About's bio for an unclaimed artist, and null when there is none", async () => {
    getPublicArtistAbout.mockResolvedValue({
      bio: "From the directory",
      kind: "researched",
      sources: [],
    });
    const artist = artistRow({ id: "u1", bio: "Own bio ignored" });
    expect((await toArtistDetail(artist)).bio).toBe("From the directory");
    expect(getPublicArtistAbout).toHaveBeenCalledWith("u1");
    getPublicArtistAbout.mockResolvedValue(null);
    expect((await toArtistDetail(artist)).bio).toBeNull();
  });

  it("maps spotifyId and deezerId from the columns and a null name to an empty string", async () => {
    const result = await toArtistDetail(
      artistRow({ name: null, spotify: "4tZwfgrHOc3mvqYlEYSvVi", deezer: "11600" }),
    );
    expect(result.name).toBe("");
    expect(result.spotifyId).toBe("4tZwfgrHOc3mvqYlEYSvVi");
    expect(result.deezerId).toBe("11600");
    const none = await toArtistDetail(artistRow());
    expect(none.spotifyId).toBeNull();
    expect(none.deezerId).toBeNull();
  });
});
