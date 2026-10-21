import { describe, it, expect, vi, beforeEach } from "vitest";

const { getAllLinks } = vi.hoisted(() => ({ getAllLinks: vi.fn() }));
vi.mock("@/lib/artists/getAllLinks", () => ({ getAllLinks }));
const { getValidatedPlatforms } = await import("@/lib/validateLink/getValidatedPlatforms");
const { VALIDATED_PLATFORMS } = await import("@/lib/validateLink/const");

beforeEach(() => vi.clearAllMocks());

describe("getValidatedPlatforms", () => {
  it("lists MusicNerdWeb's eleven platforms in order, mintsongs included", async () => {
    getAllLinks.mockResolvedValue([]);
    const names = (await getValidatedPlatforms()).map(p => p.name);
    expect(names).toEqual([
      "youtube",
      "youtubechannel",
      "soundcloud",
      "bandcamp",
      "audius",
      "lastfm",
      "opensea",
      "zora",
      "catalog",
      "supercollector",
      "mintsongs",
    ]);
  });

  it("uses a valid, trimmed urlmap pattern over the built-in one, without changing the built-in", async () => {
    getAllLinks.mockResolvedValue([
      { siteName: "soundcloud", regex: "  ^https://sc\\.test/  " },
      { siteName: "audius", regex: "(" },
      { siteName: "zora", regex: "" },
    ]);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const platforms = await getValidatedPlatforms();
    const regexOf = (name: string) => platforms.find(p => p.name === name)!.regex;
    expect(regexOf("soundcloud").source).toBe("^https:\\/\\/sc\\.test\\/");
    expect(regexOf("audius")).toBe(VALIDATED_PLATFORMS.find(p => p.name === "audius")!.regex);
    expect(regexOf("zora")).toBe(VALIDATED_PLATFORMS.find(p => p.name === "zora")!.regex);
    expect(VALIDATED_PLATFORMS.find(p => p.name === "soundcloud")!.regex.source).toContain(
      "soundcloud",
    );
    log.mockRestore();
  });

  it("never applies an ens or wallets pattern, and keeps the built-ins when urlmap fails", async () => {
    getAllLinks.mockResolvedValue([{ siteName: "wallets", regex: "^x" }]);
    expect(await getValidatedPlatforms()).toEqual(VALIDATED_PLATFORMS);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    getAllLinks.mockRejectedValue(new Error("db down"));
    expect(await getValidatedPlatforms()).toEqual(VALIDATED_PLATFORMS);
    log.mockRestore();
  });
});
