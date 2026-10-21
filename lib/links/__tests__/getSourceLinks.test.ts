import { describe, it, expect } from "vitest";
import { getSourceLinks } from "@/lib/links/getSourceLinks";
import { isDestinationSource } from "@/lib/links/isDestinationSource";

const source = (id: string, url: string, type = "article", title = "") => ({
  id,
  url,
  type,
  title,
});

describe("getSourceLinks", () => {
  const sources = [
    source("apple", "https://music.apple.com/us/artist/pete-rango/1513734272", "profile"),
    source("beatport", "https://www.beatport.com/artist/pete-rango/1041889"),
    source("release", "https://www.beatport.com/release/rush/6008044", "article", "rush"),
    source("website", "https://peterango.com/", "website"),
    source("review", "https://pitchfork.com/reviews/some-album", "review"),
    source("support", "https://peterango.bandcamp.com/album/rush"),
  ];

  it("shows catalog profiles and the website as named destinations, leaving the records unchanged", () => {
    const original = JSON.stringify(sources);
    expect(getSourceLinks(sources).map(link => [link.label, link.kind])).toEqual([
      ["peterango.com", "website"],
      ["Apple Music", "artist"],
      ["Beatport", "artist"],
    ]);
    expect(JSON.stringify(sources)).toBe(original);
    expect(sources.filter(s => isDestinationSource(s))).toHaveLength(3);
  });

  it("puts support destinations in the support section", () => {
    expect(
      getSourceLinks(
        [...sources, source("support-artist", "https://peterango.bandcamp.com/")],
        [],
        "support",
      ),
    ).toEqual([expect.objectContaining({ sourceId: "support-artist", label: "Bandcamp" })]);
  });

  it("keeps existing artist links and skips another profile on a shown platform", () => {
    const existing = [
      {
        siteName: "applemusic",
        href: "https://music.apple.com/artist/42",
        label: "Apple Music",
        iconSrc: "",
      },
    ];
    expect(
      getSourceLinks(
        [...sources, source("alternate", "https://beatport.com/artist/renamed/1041889")],
        existing,
      ).map(link => link.sourceId),
    ).toEqual(["website", "beatport"]);
  });

  it("hides pending sources, podcast episodes, unsafe URLs and pages under the main site", () => {
    expect(
      getSourceLinks([
        { ...source("pending", "https://audius.co/Dutchyyy"), status: "pending" },
        { ...source("podcast", "https://music.apple.com/us/artist/x/1"), podcastEpisodeKey: "e" },
        source("unsafe", "javascript:alert(1)", "website"),
      ]),
    ).toEqual([]);
    expect(
      getSourceLinks([
        source("main", "https://peterango.com/", "website"),
        source("page", "https://peterango.com/tour", "website"),
      ]).map(link => link.sourceId),
    ).toEqual(["main"]);
  });

  it("gives local icons to source-backed Apple Music and Beatport links", () => {
    expect(
      getSourceLinks([
        source("apple", "https://music.apple.com/us/artist/pete-rango/1513734272"),
        source("beatport", "https://www.beatport.com/artist/pete-rango/1041889"),
      ]).map(link => link.iconSrc),
    ).toEqual(["/siteIcons/applemusic_icon.svg", "/siteIcons/beatport_icon.svg"]);
  });
});
