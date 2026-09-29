import { describe, it, expect, vi, beforeEach } from "vitest";
import { goodPage, searchRun } from "@/lib/vault/__tests__/searchRun";

const h = vi.hoisted(() => ({
  fetchPageContent: vi.fn(),
  judgeSourceRelevance: vi.fn(),
  insertVaultSource: vi.fn(async (row: { url: string }) => ({ id: row.url, url: row.url })),
}));
vi.mock("@/lib/pages/fetchPageContent", () => ({ fetchPageContent: h.fetchPageContent }));
vi.mock("@/lib/relevance/judgeSourceRelevance", () => ({
  judgeSourceRelevance: h.judgeSourceRelevance,
}));
vi.mock("@/lib/vault/insertVaultSource", () => ({ insertVaultSource: h.insertVaultSource }));
const { followIndexLinks } = await import("@/lib/vault/followIndexLinks");

const anchor = { name: "Grimes", catalog: [], identifiers: [] };
const affirm = (urls: string[]) => async (_a: unknown, c: { url: string }[]) =>
  new Map(c.map(x => [x.url, urls.includes(x.url) ? "about-artist" : "not-about-artist"]));
beforeEach(() => {
  h.fetchPageContent.mockReset().mockResolvedValue(goodPage);
  h.judgeSourceRelevance.mockReset().mockImplementation(affirm(["https://example.com/story"]));
  h.insertVaultSource.mockClear();
});

describe("followIndexLinks", () => {
  it("follows at most three new links and saves only what the judge affirms", async () => {
    const run = searchRun({
      indexLinks: new Set([
        "https://example.com/old",
        "https://www.linkedin.com/in/grimes",
        "https://example.com/story",
        "https://example.com/other",
        "https://example.com/4",
        "https://example.com/5",
      ]),
      existingUrls: new Set(["https://example.com/old"]),
    });
    await followIndexLinks(run, anchor);
    expect(h.fetchPageContent.mock.calls.map(c => c[0])).toEqual([
      "https://example.com/story",
      "https://example.com/other",
      "https://example.com/4",
    ]);
    expect(h.insertVaultSource).toHaveBeenCalledTimes(1);
    expect(h.insertVaultSource).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://example.com/story",
        type: "article",
        extractedText: goodPage.extractedText,
      }),
    );
    expect(run.saved.map(s => s.url)).toEqual(["https://example.com/story"]);
  });

  it("drops unreadable and LinkedIn-redirected pages before judging, and blocked hosts before saving", async () => {
    h.fetchPageContent.mockImplementation(async (url: string) =>
      url.includes("empty")
        ? { ...goodPage, fullText: "" }
        : url.includes("redirect")
          ? { ...goodPage, resolvedUrl: "https://linkedin.com/in/x" }
          : goodPage,
    );
    h.judgeSourceRelevance.mockImplementation(affirm(["https://www.viberate.com/artist/grimes"]));
    const run = searchRun({
      indexLinks: new Set([
        "https://example.com/empty",
        "https://example.com/redirect",
        "https://www.viberate.com/artist/grimes",
      ]),
    });
    await followIndexLinks(run, anchor);
    expect(h.judgeSourceRelevance.mock.calls[0][1].map((c: { url: string }) => c.url)).toEqual([
      "https://www.viberate.com/artist/grimes",
    ]);
    expect(h.insertVaultSource).not.toHaveBeenCalled();
  });

  it("throws for a durable run out of time, and rethrows its failed writes", async () => {
    const indexLinks = new Set(["https://example.com/story"]);
    await expect(
      followIndexLinks(
        searchRun({ indexLinks, deadline: Date.now() - 1, requireComplete: true }),
        anchor,
      ),
    ).rejects.toThrow("index following");
    h.insertVaultSource.mockRejectedValueOnce(new Error("source database unavailable"));
    await expect(
      followIndexLinks(searchRun({ indexLinks, requireComplete: true }), anchor),
    ).rejects.toThrow("source database unavailable");
  });
});
