import { afterEach, describe, expect, it, vi } from "vitest";
import { searchRun } from "@/lib/vault/__tests__/searchRun";

const { webSearch } = vi.hoisted(() => ({ webSearch: vi.fn() }));
vi.mock("@/lib/search/webSearch", () => ({ webSearch }));
const { searchMissingYouTubeChannels } = await import("@/lib/vault/searchMissingYouTubeChannels");

afterEach(() => vi.restoreAllMocks());

describe("searchMissingYouTubeChannels", () => {
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

    expect(await searchMissingYouTubeChannels(searchRun())).toEqual(hits);

    expect(log).toHaveBeenCalledExactlyOnceWith(
      '[vaultWebSearch] Missing YouTube search returned 6 results; paths=["/@artist","/channel/UC123","unexpected_host","invalid_url","/watch"]',
    );
    expect(log.mock.calls.flat().join(" ")).not.toMatch(/secret|password|private|over-the-limit/);
  });
});
