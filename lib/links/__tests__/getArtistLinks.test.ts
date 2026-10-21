import { it, expect, vi, beforeEach } from "vitest";

const getAllLinks = vi.hoisted(() => vi.fn());
vi.mock("@/lib/artists/getAllLinks", () => ({ getAllLinks }));
const { getArtistLinks } = await import("@/lib/links/getArtistLinks");

const row = (siteName: string, appStringFormat: string, order: number) => ({
  siteName,
  appStringFormat,
  order,
});
const artist = (values: Record<string, string | null>) => values as never;

beforeEach(() =>
  getAllLinks
    .mockReset()
    .mockResolvedValue([
      row("instagram", "https://instagram.com/%@", 3),
      row("youtube", "https://youtube.com/%@", 2),
      row("youtubechannel", "https://youtube.com/channel/%@", 2),
      row("soundcloud", "https://soundcloud.com/%@", 4),
      row("supercollector", "https://release.supercollector.xyz/artist/%@", 5),
      row("facebook", "https://facebook.com/%@", 6),
      row("facebookID", "%@", 6),
      row("tiktokID", "https://tiktok.com/%@", 7),
      row("ens", "%@", 1),
    ]),
);

it("builds each filled column's URL in urlmap order", async () => {
  const links = await getArtistLinks(
    artist({
      instagram: "pete",
      youtube: "@pete",
      soundcloud: "pete",
      supercollector: "pete.eth",
      facebookId: "https://facebook.com/profile.php?id=1",
      tiktokId: "123",
      ens: "pete.eth",
    }),
  );
  expect(links.map(link => [link.siteName, link.artistUrl])).toEqual([
    ["youtube", "https://youtube.com/@pete"],
    ["instagram", "https://instagram.com/pete"],
    ["soundcloud", "https://soundcloud.com/pete"],
    ["supercollector", "https://release.supercollector.xyz/artist/pete"],
    ["facebookID", "https://facebook.com/profile.php?id=1"],
  ]);
});

it("prefers usernames, reads legacy @ channels, and skips numeric SoundCloud ids", async () => {
  const both = await getArtistLinks(
    artist({
      youtube: "pete",
      youtubechannel: "UC1",
      facebook: "pete",
      facebookId: "https://fb/1",
    }),
  );
  expect(both.map(link => link.siteName)).toEqual(["youtube", "facebook"]);
  const legacy = await getArtistLinks(artist({ youtubechannel: "@pete", soundcloud: "12345" }));
  expect(legacy.map(link => link.artistUrl)).toEqual(["https://youtube.com/@pete"]);
  const channel = await getArtistLinks(artist({ youtubechannel: "UC1" }));
  expect(channel[0].artistUrl).toBe("https://www.youtube.com/channel/UC1");
});

it("fails as MusicNerdWeb does when the urlmap can't be read", async () => {
  getAllLinks.mockRejectedValueOnce(new Error("offline"));
  await expect(getArtistLinks(artist({}))).rejects.toThrow("Error fetching artist links");
});
