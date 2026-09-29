import { describe, it, expect } from "vitest";
import { genericArtistId } from "@/lib/artists/genericArtistId";

const m = (groups: (string | undefined)[]) => ["full", ...groups] as unknown as RegExpMatchArray;

describe("genericArtistId", () => {
  it("takes the first capture group, percent-decoded", () => {
    expect(genericArtistId("wikipedia", m(["Yun%C3%A8_Pinku"]), "Wikipedia")).toEqual({
      siteName: "wikipedia",
      cardPlatformName: "Wikipedia",
      id: "Yunè_Pinku",
    });
    expect(genericArtistId("bandcamp", m([undefined, "dupes"]), null)?.id).toBe("dupes");
  });

  it("prefers group 2 for SoundCloud, whose group 1 is the optional www.", () => {
    expect(genericArtistId("soundcloud", m(["www.", "peterango"]), null)?.id).toBe("peterango");
  });

  it("rejects numeric SoundCloud ids and empty captures", () => {
    expect(genericArtistId("soundcloud", m([undefined, "123"]), null)).toBeNull();
    expect(genericArtistId("instagram", m([]), null)).toBeNull();
  });

  it("strips X query strings and lowercases ENS names", () => {
    expect(genericArtistId("x", m(["pete?si=2"]), null)?.id).toBe("pete");
    expect(genericArtistId("ens", m([" Pete.ETH "]), null)?.id).toBe("pete.eth");
  });

  it("keeps a capture that is not valid percent-encoding as it is", () => {
    expect(genericArtistId("instagram", m(["100%"]), null)?.id).toBe("100%");
  });
});
