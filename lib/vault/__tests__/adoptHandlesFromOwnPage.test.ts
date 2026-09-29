import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  resolve: vi.fn(),
  belongs: vi.fn(async (_artistId: string, _site: string, _handle: string) => false),
  contradicts: vi.fn(async (_artistId: string, _site: string, _handle: string) => false),
  ambiguous: vi.fn(async (_artistId: string, _name: string) => false),
  writeArtistLink: vi.fn(
    async (
      _a: string,
      _site: string,
      _value: string,
      _provisional?: Set<string>,
      _record?: Record<string, unknown>,
    ) => {},
  ),
}));
vi.mock("@/lib/vault/resolveOutboundHandles", () => ({ resolveOutboundHandles: m.resolve }));
vi.mock("@/lib/identity/handleBelongsToAnotherArtist", () => ({
  handleBelongsToAnotherArtist: m.belongs,
}));
vi.mock("@/lib/identity/contradictsScrapedPosts", () => ({
  contradictsScrapedPosts: m.contradicts,
}));
vi.mock("@/lib/identity/nameIsAmbiguousInDirectory", () => ({
  nameIsAmbiguousInDirectory: m.ambiguous,
}));
vi.mock("@/lib/vault/writeArtistLink", () => ({ writeArtistLink: m.writeArtistLink }));
const { adoptHandlesFromOwnPage } = await import("@/lib/vault/adoptHandlesFromOwnPage");

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("adoptHandlesFromOwnPage", () => {
  it("adopts the handles on a page that links an id we already hold", async () => {
    m.resolve.mockResolvedValueOnce([
      { siteName: "bandcamp", id: "dupes" },
      { siteName: "instagram", id: "dupesdidit" },
      { siteName: "wikipedia", id: "Dupes" },
      { siteName: "x", id: "p" },
    ]);
    const artist = { name: "Sherwinn Dupes Brice", bandcamp: "@dupes" };
    const result = await adoptHandlesFromOwnPage("a1", ["l"], artist, "Sherwinn Dupes Brice");
    expect(m.writeArtistLink.mock.calls.map(c => [c[1], c[2]])).toEqual([
      ["instagram", "dupesdidit"],
    ]);
    expect(result).toEqual({ adopted: 1, handles: new Set(["dupesdidit"]) });
  });

  it("adopts nothing from a page that corroborates nothing and isn't their domain", async () => {
    m.resolve.mockResolvedValueOnce([{ siteName: "instagram", id: "rvamag" }]);
    expect(
      await adoptHandlesFromOwnPage("a1", ["l"], { name: "Pete Rango" }, "Pete Rango", {
        url: "https://rvamag.com",
        aboutArtist: true,
      }),
    ).toEqual({
      adopted: 0,
      handles: new Set(),
    });
  });

  it("accepts the artist's own domain only when the judge affirmed it and the name isn't shared", async () => {
    const page = { url: "https://peterango.com", aboutArtist: true };
    m.resolve.mockResolvedValue([{ siteName: "instagram", id: "p3t3rango" }]);
    expect(
      (await adoptHandlesFromOwnPage("a1", ["l"], { name: "Pete Rango" }, "Pete Rango", page))
        .adopted,
    ).toBe(1);
    expect(
      (
        await adoptHandlesFromOwnPage("a1", ["l"], { name: "Pete Rango" }, "Pete Rango", {
          ...page,
          aboutArtist: false,
        })
      ).adopted,
    ).toBe(0);
    m.ambiguous.mockResolvedValueOnce(true);
    expect(
      (await adoptHandlesFromOwnPage("a1", ["l"], { name: "Pete Rango" }, "Pete Rango", page))
        .adopted,
    ).toBe(0);
  });

  it("keeps only the handles that resemble the artist when a page mixes them with others", async () => {
    m.resolve.mockResolvedValueOnce([
      { siteName: "soundcloud", id: "hardwell" },
      { siteName: "youtube", id: "insomniac" },
      { siteName: "x", id: "hardwell" },
    ]);
    await adoptHandlesFromOwnPage(
      "a1",
      ["l"],
      { name: "Hardwell", soundcloud: "hardwell" },
      "Hardwell",
    );
    expect(m.writeArtistLink.mock.calls.map(c => [c[1], c[2]])).toEqual([["x", "hardwell"]]);
  });

  it("abstains on a platform the page names twice, reserved handles, and repeats", async () => {
    m.resolve.mockResolvedValueOnce([
      { siteName: "bandcamp", id: "dupes" },
      { siteName: "instagram", id: "artist1" },
      { siteName: "instagram", id: "label1" },
      { siteName: "x", id: "p" },
      { siteName: "tiktok", id: "dupesx" },
      { siteName: "tiktok", id: "dupesx" },
    ]);
    await adoptHandlesFromOwnPage("a1", ["l"], { name: "Dupes", bandcamp: "dupes" }, "Dupes");
    expect(m.writeArtistLink.mock.calls.map(c => [c[1], c[2]])).toEqual([["tiktok", "dupesx"]]);
  });

  it("respects held and provisional columns, the ownership guard and their own posts", async () => {
    const provisional = new Set(["x"]);
    m.resolve.mockResolvedValueOnce([
      { siteName: "bandcamp", id: "dupes" },
      { siteName: "x", id: "dupes2" },
      { siteName: "instagram", id: "dupes3" },
      { siteName: "tiktok", id: "dupes4" },
      { siteName: "youtube", id: "dupes5" },
    ]);
    m.belongs.mockImplementation(async (_a: string, site: string) => site === "instagram");
    m.contradicts.mockImplementation(async (_a: string, site: string) => site === "tiktok");
    const artist = { name: "Dupes", bandcamp: "dupes", x: "guess", youtube: "held" };
    await adoptHandlesFromOwnPage("a1", ["l"], artist, "Dupes", undefined, provisional);
    expect(m.writeArtistLink.mock.calls.map(c => [c[1], c[2]])).toEqual([["x", "dupes2"]]);
    expect(m.writeArtistLink.mock.calls[0][3]).toBe(provisional);
    expect(m.writeArtistLink.mock.calls[0][4]).toBe(artist);
    m.belongs.mockImplementation(async () => false);
    m.contradicts.mockImplementation(async () => false);
  });

  it("counts only the writes that succeeded", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    m.resolve.mockResolvedValueOnce([
      { siteName: "bandcamp", id: "dupes" },
      { siteName: "x", id: "dupesx" },
    ]);
    m.writeArtistLink.mockImplementationOnce(async () => {
      throw new Error("conflict");
    });
    expect(
      await adoptHandlesFromOwnPage("a1", ["l"], { name: "Dupes", bandcamp: "dupes" }, "Dupes"),
    ).toEqual({
      adopted: 0,
      handles: new Set(),
    });
  });
});
