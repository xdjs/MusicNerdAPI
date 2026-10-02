import { describe, it, expect, vi, beforeEach } from "vitest";

const { webSearch, resultPassesNameCheck } = vi.hoisted(() => ({
  webSearch: vi.fn(),
  resultPassesNameCheck: vi.fn(),
}));
vi.mock("@/lib/search/webSearch", () => ({ webSearch }));
vi.mock("@/lib/discovery/resultPassesNameCheck", () => ({ resultPassesNameCheck }));
const { searchPlatformCandidates } = await import("@/lib/discovery/searchPlatformCandidates");

beforeEach(() => {
  webSearch.mockReset();
  resultPassesNameCheck.mockReset();
});

describe("searchPlatformCandidates", () => {
  it("searches the platform's own domain and keeps passing https results in rank order", async () => {
    webSearch.mockResolvedValueOnce([
      { url: "http://instagram.com/a", title: "A", snippet: "" },
      { url: "https://instagram.com/b", title: "B", snippet: "" },
      { url: "https://instagram.com/c", title: "", snippet: "C snippet" },
    ]);
    resultPassesNameCheck.mockResolvedValue(true);
    expect(await searchPlatformCandidates("instagram", "q", "Pete Rango")).toEqual([
      {
        tier: 4,
        platform: "instagram",
        url: "https://instagram.com/b",
        reasoning: 'Web search hit on instagram.com: "B"',
      },
      {
        tier: 4,
        platform: "instagram",
        url: "https://instagram.com/c",
        reasoning: 'Web search hit on instagram.com: "C snippet"',
      },
    ]);
    expect(webSearch).toHaveBeenCalledWith("q", {
      includeDomains: ["instagram.com"],
      maxResults: 5,
    });
  });

  it("is empty when the search throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    webSearch.mockRejectedValueOnce(new Error("down"));
    expect(await searchPlatformCandidates("x", "q", "P")).toEqual([]);
    error.mockRestore();
  });
});
