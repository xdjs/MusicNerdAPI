import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchRun } from "@/lib/vault/__tests__/searchRun";

const { webSearch } = vi.hoisted(() => ({ webSearch: vi.fn() }));
vi.mock("@/lib/search/webSearch", () => ({ webSearch }));
const { searchCandidates } = await import("@/lib/vault/searchCandidates");

beforeEach(() => {
  webSearch.mockReset().mockResolvedValue([]);
});

describe("searchCandidates", () => {
  it("keeps five broad queries when a YouTube account is already saved", async () => {
    const artist = { name: "Grimes", youtube: "grimes" };
    await searchCandidates(searchRun({ artist, requireComplete: true }), null);
    expect(webSearch).toHaveBeenCalledTimes(5);
    expect(webSearch).toHaveBeenCalledWith("Grimes", { maxResults: 5, throwOnError: true });
    await searchCandidates(searchRun({ artist }), null);
    expect(webSearch).toHaveBeenLastCalledWith('"Grimes" discogs credits', { maxResults: 5 });
  });

  it("adds one bounded YouTube search for a missing account and prioritizes its real result", async () => {
    const channel = "https://www.youtube.com/channel/UCh7KEjrvinFL2zZc_lz4LwQ";
    webSearch.mockImplementation(async (_query, options) =>
      options?.includeDomains
        ? [
            {
              url: channel,
              title: "Svaneborg Kardyb - YouTube",
              snippet: "Official artist channel",
            },
          ]
        : [{ url: "https://example.com/review", title: "Review", snippet: "" }],
    );
    const results = await searchCandidates(
      searchRun({
        artistName: "Svaneborg Kardyb",
        artist: { name: "Svaneborg Kardyb" },
        requireComplete: true,
      }),
      "https://svaneborgkardyb.com/",
    );
    expect(webSearch).toHaveBeenCalledTimes(6);
    expect(webSearch).toHaveBeenCalledWith("Svaneborg Kardyb official YouTube channel", {
      includeDomains: ["youtube.com/@", "youtube.com/channel/"],
      maxResults: 5,
      throwOnError: true,
    });
    expect(results.map(result => result.url)).toEqual([
      "https://svaneborgkardyb.com/",
      channel,
      "https://example.com/review",
    ]);
  });

  it.each([
    { artist: { youtube: "saved-handle" }, provisional: new Set<string>() },
    { artist: { youtubechannel: "UCsaved" }, provisional: new Set<string>() },
    { artist: { youtube: "guess", youtubechannel: "UCsaved" }, provisional: new Set(["youtube"]) },
  ])("does not search YouTube while either non-provisional slot is saved: %o", async state => {
    await searchCandidates(searchRun(state), null);
    expect(webSearch.mock.calls.filter(([, options]) => options?.includeDomains)).toHaveLength(0);
  });

  it.each(["youtube", "youtubechannel"])(
    "searches again when the only %s value is provisional",
    async site => {
      await searchCandidates(
        searchRun({ artist: { [site]: "guess" }, provisional: new Set([site]) }),
        null,
      );
      expect(webSearch.mock.calls.filter(([, options]) => options?.includeDomains)).toHaveLength(1);
    },
  );

  it("does not hide a targeted provider failure in a durable run", async () => {
    webSearch.mockImplementation(async (_query, options) => {
      if (options?.includeDomains) throw new Error("YouTube search unavailable");
      return [];
    });
    await expect(searchCandidates(searchRun({ requireComplete: true }), null)).rejects.toThrow(
      "YouTube search unavailable",
    );
  });

  it("dedupes across queries by normalized URL, drops untitled hits and types each by its URL", async () => {
    webSearch.mockResolvedValue([
      { url: "https://example.com/a", title: "A", snippet: "s" },
      { url: "https://www.example.com/a/", title: "A again", snippet: "s" },
      { url: "https://example.com/b", title: "", snippet: "s" },
    ]);
    const results = await searchCandidates(searchRun(), null);
    expect(results.map(r => r.url)).toEqual(["https://example.com/a"]);
    expect(results[0]).toHaveProperty("type");
  });

  it("seeds the MusicBrainz homepage first, so it survives the dedupe", async () => {
    webSearch.mockResolvedValue([
      { url: "https://grimes.com", title: "Search copy", snippet: "x" },
    ]);
    const results = await searchCandidates(searchRun(), "https://grimes.com");
    expect(results).toEqual([
      { url: "https://grimes.com", title: "Grimes", snippet: "", type: expect.any(String) },
    ]);
  });

  it("propagates a provider failure", async () => {
    webSearch.mockRejectedValue(new Error("provider unavailable"));
    await expect(searchCandidates(searchRun({ requireComplete: true }), null)).rejects.toThrow(
      "provider unavailable",
    );
  });
});
