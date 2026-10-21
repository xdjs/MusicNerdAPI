import { describe, it, expect, vi, beforeEach } from "vitest";
import { artistRow } from "@/lib/mcp/__tests__/artistRow";

const { getAllLinks } = vi.hoisted(() => ({
  getAllLinks: vi.fn(async (): Promise<unknown[]> => []),
}));
vi.mock("@/lib/artists/getAllLinks", () => ({ getAllLinks }));
const { getArtistLinks } = await import("@/lib/artists/getArtistLinks");

const row = (siteName: string, appStringFormat: string, order: number | null = null) => ({
  id: siteName,
  siteName,
  appStringFormat,
  order,
  cardPlatformName: null,
  regex: "",
  siteImage: null,
  colorHex: null,
});
const urls = async (artist: ReturnType<typeof artistRow>) =>
  (await getArtistLinks(artist)).map(l => [l.siteName, l.artistUrl]);

beforeEach(() => vi.clearAllMocks());

describe("getArtistLinks", () => {
  it("substitutes the artist's value into the template, skipping empty values, ens and wallets", async () => {
    getAllLinks.mockResolvedValue([
      row("instagram", "https://instagram.com/%@"),
      row("x", "https://x.com/%@"),
      row("ens", "https://app.ens.domains/%@"),
      row("wallets", "%@"),
      row("bandcamp", "https://%@.bandcamp.com"),
    ]);
    expect(
      await urls(artistRow({ instagram: "pete", x: "", ens: "pete.eth", bandcamp: null })),
    ).toEqual([["instagram", "https://instagram.com/pete"]]);
  });

  it("builds YouTube URLs: username (@ stripped), channel id, legacy @ in the channel column, username wins over channel", async () => {
    getAllLinks.mockResolvedValue([row("youtube", "y/%@"), row("youtubechannel", "yc/%@")]);
    expect(await urls(artistRow({ youtube: "@pete" }))).toEqual([
      ["youtube", "https://youtube.com/@pete"],
    ]);
    expect(await urls(artistRow({ youtubechannel: "UC123" }))).toEqual([
      ["youtubechannel", "https://www.youtube.com/channel/UC123"],
    ]);
    expect(await urls(artistRow({ youtubechannel: "@legacy" }))).toEqual([
      ["youtubechannel", "https://youtube.com/@legacy"],
    ]);
    expect(await urls(artistRow({ youtube: "pete", youtubechannel: "UC123" }))).toEqual([
      ["youtube", "https://youtube.com/@pete"],
    ]);
  });

  it("uses the stored facebookID URL as is, and skips it when the facebook username is also set", async () => {
    getAllLinks.mockResolvedValue([
      row("facebook", "https://www.facebook.com/%@"),
      row("facebookID", "fb/%@"),
    ]);
    expect(
      await urls(artistRow({ facebookId: "https://www.facebook.com/profile.php?id=1" })),
    ).toEqual([["facebookID", "https://www.facebook.com/profile.php?id=1"]]);
    expect(
      await urls(
        artistRow({ facebook: "pete", facebookId: "https://www.facebook.com/profile.php?id=1" }),
      ),
    ).toEqual([["facebook", "https://www.facebook.com/pete"]]);
  });

  it("strips .eth from supercollector and skips numeric soundcloud ids", async () => {
    getAllLinks.mockResolvedValue([
      row("supercollector", "https://supercollector.xyz/%@"),
      row("soundcloud", "https://soundcloud.com/%@"),
    ]);
    expect(await urls(artistRow({ supercollector: "pete.eth", soundcloud: "12345" }))).toEqual([
      ["supercollector", "https://supercollector.xyz/pete"],
    ]);
    expect(await urls(artistRow({ soundcloud: "pete" }))).toEqual([
      ["soundcloud", "https://soundcloud.com/pete"],
    ]);
  });

  it("sorts by the urlmap order and keeps the row's fields", async () => {
    getAllLinks.mockResolvedValue([
      row("x", "https://x.com/%@", 5),
      row("instagram", "https://instagram.com/%@", 1),
      row("tiktok", "https://tiktok.com/@%@"),
    ]);
    const links = await getArtistLinks(artistRow({ x: "a", instagram: "b", tiktok: "c" }));
    expect(links.map(l => l.siteName)).toEqual(["tiktok", "instagram", "x"]);
    expect(links[1]).toMatchObject({
      id: "instagram",
      order: 1,
      artistUrl: "https://instagram.com/b",
    });
  });

  it("reports a failure as 'Error fetching artist links'", async () => {
    getAllLinks.mockRejectedValue(new Error("db"));
    await expect(getArtistLinks(artistRow())).rejects.toThrow("Error fetching artist links");
  });
});
