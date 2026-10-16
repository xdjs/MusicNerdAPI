import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchRun } from "@/lib/vault/__tests__/searchRun";

const { webSearch } = vi.hoisted(() => ({ webSearch: vi.fn() }));
vi.mock("@/lib/search/webSearch", () => ({ webSearch }));
const { searchMissingYouTubeChannels } = await import("@/lib/vault/searchMissingYouTubeChannels");

beforeEach(() => {
  webSearch.mockReset().mockResolvedValue([]);
});
afterEach(() => vi.restoreAllMocks());

describe("searchMissingYouTubeChannels", () => {
  it.each([
    { artist: { youtube: "saved-handle" }, provisional: new Set<string>() },
    { artist: { youtubechannel: "UCsaved" }, provisional: new Set<string>() },
    { artist: { youtube: "guess", youtubechannel: "UCsaved" }, provisional: new Set(["youtube"]) },
  ])("does not query while either non-provisional slot is saved: %o", async state => {
    await searchMissingYouTubeChannels(searchRun(state), 0);
    expect(webSearch).not.toHaveBeenCalled();
  });

  it.each(["youtube", "youtubechannel"])(
    "searches when the only %s value is provisional",
    async site => {
      await searchMissingYouTubeChannels(
        searchRun({ artist: { [site]: "guess" }, provisional: new Set([site]) }),
        0,
      );
      expect(webSearch).toHaveBeenCalledTimes(1);
    },
  );

  it("propagates a provider failure for durable discovery", async () => {
    webSearch.mockRejectedValue(new Error("provider unavailable"));
    await expect(
      searchMissingYouTubeChannels(searchRun({ requireComplete: true }), 0),
    ).rejects.toThrow("provider unavailable");
  });

  it("logs bounded YouTube paths without query strings, credentials or page contents", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const hits = [
      {
        url: "https://secret:password@www.youtube.com/@artist?secret=token#fragment",
        title: "private title",
        snippet: "private snippet",
      },
      { url: "https://www.youtube.com/channel/UC123", title: "Channel", snippet: "" },
      { url: "https://elsewhere.example/private-path?secret=token", title: "Other", snippet: "" },
      { url: "invalid-url", title: "Invalid", snippet: "" },
      { url: "https://www.youtube.com/watch?v=secret", title: "Video", snippet: "" },
      { url: "https://www.youtube.com/@over-the-limit", title: "Excess", snippet: "" },
    ];
    webSearch.mockResolvedValue(hits);

    expect(await searchMissingYouTubeChannels(searchRun(), 2)).toEqual(hits);

    expect(log).toHaveBeenCalledExactlyOnceWith(
      '[vaultWebSearch] Missing YouTube stage=filtered returned 6 results; paths=["/@artist","/channel/UC123","unexpected_host","invalid_url","/watch"]',
    );
    expect(log.mock.calls.flat().join(" ")).not.toMatch(/secret|password|private|over-the-limit/);
  });

  it("uses the benchmark-derived basic query order and bounded results", async () => {
    webSearch.mockResolvedValue([]);
    const run = searchRun({ artistName: "Grimes", requireComplete: true });
    await searchMissingYouTubeChannels(run, 0);
    await searchMissingYouTubeChannels(run, 1);
    await searchMissingYouTubeChannels(run, 2);
    expect(webSearch).toHaveBeenNthCalledWith(1, "Grimes official YouTube channel", {
      maxResults: 10,
      throwOnError: true,
    });
    expect(webSearch).toHaveBeenNthCalledWith(2, '"Grimes" YouTube', {
      maxResults: 10,
      throwOnError: true,
    });
    expect(webSearch).toHaveBeenNthCalledWith(3, "Grimes official YouTube channel", {
      includeDomains: ["youtube.com/@", "youtube.com/channel/"],
      maxResults: 5,
      throwOnError: true,
    });
  });
});
