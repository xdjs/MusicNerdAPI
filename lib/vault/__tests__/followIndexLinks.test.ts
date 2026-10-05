import { describe, it, expect, vi, beforeEach } from "vitest";
import { goodPage, searchRun } from "@/lib/vault/__tests__/searchRun";
import { normalizeLoreDiscoveryUrl } from "@/lib/sources/normalizeLoreDiscoveryUrl";

const h = vi.hoisted(() => ({
  fetchPageContent: vi.fn(),
  ambiguous: vi.fn(async () => false),
  judgeSourceRelevance: vi.fn(),
  insertVaultSource: vi.fn(async (row: { url: string }) => ({ id: row.url, url: row.url })),
}));
vi.mock("@/lib/identity/nameIsAmbiguousInDirectory", () => ({
  nameIsAmbiguousInDirectory: h.ambiguous,
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
  h.ambiguous.mockReset().mockResolvedValue(false);
});

describe("followIndexLinks", () => {
  it("classifies and stores the final catalog URL instead of a redirect token", async () => {
    const redirect = "https://example.com/listen";
    const url = "https://music.apple.com/artist/grimes/123";
    h.fetchPageContent.mockResolvedValue({ ...goodPage, resolvedUrl: url });
    h.judgeSourceRelevance.mockImplementation(affirm([url]));
    await followIndexLinks(searchRun({ indexLinks: new Set([redirect]) }), anchor);
    expect(h.insertVaultSource).toHaveBeenCalledWith(
      expect.objectContaining({ url, type: "music" }),
    );
  });
  it("applies ambiguity and existing-source decisions to the final catalog URL", async () => {
    const redirect = "https://example.com/listen";
    const url = "https://music.apple.com/artist/grimes/123";
    h.fetchPageContent.mockResolvedValue({ ...goodPage, resolvedUrl: url });
    h.judgeSourceRelevance.mockImplementation(affirm([url]));
    h.ambiguous.mockResolvedValue(true);
    await followIndexLinks(searchRun({ indexLinks: new Set([redirect]) }), anchor);
    expect(h.ambiguous).toHaveBeenCalled();
    expect(h.insertVaultSource).not.toHaveBeenCalled();
    h.ambiguous.mockClear().mockResolvedValue(false);
    await followIndexLinks(
      searchRun({
        indexLinks: new Set([redirect]),
        existingUrls: new Set([normalizeLoreDiscoveryUrl(url)]),
      }),
      anchor,
    );
    expect(h.insertVaultSource).not.toHaveBeenCalled();
  });
  it.each([
    "http://127.0.0.1/private",
    "https://user:password@example.com/",
    "https://www.viberate.com/artist/grimes",
  ])("rejects an unsafe or blocked index destination before judging: %s", async resolvedUrl => {
    h.fetchPageContent.mockResolvedValue({ ...goodPage, resolvedUrl });
    await followIndexLinks(
      searchRun({ indexLinks: new Set(["https://example.com/redirect"]) }),
      anchor,
    );
    expect(h.judgeSourceRelevance).not.toHaveBeenCalled();
    expect(h.insertVaultSource).not.toHaveBeenCalled();
  });
  it.each([
    "https://soundcloud.com/interview-show/grimes-chat",
    "https://www.mixcloud.com/interview-show/grimes-chat/",
    "https://audius.co/interview_show/grimes-chat",
  ])("keeps affirmed spoken coverage despite an ambiguous artist name: %s", async url => {
    h.ambiguous.mockResolvedValue(true);
    h.judgeSourceRelevance.mockImplementation(affirm([url]));
    await followIndexLinks(searchRun({ indexLinks: new Set([url]) }), anchor);
    expect(h.insertVaultSource).toHaveBeenCalledWith(
      expect.objectContaining({ url, type: "audio" }),
    );
    expect(h.ambiguous).not.toHaveBeenCalled();
  });

  it("still blocks a music catalog when the artist name is ambiguous", async () => {
    const url = "https://music.apple.com/artist/grimes/123";
    h.ambiguous.mockResolvedValue(true);
    h.judgeSourceRelevance.mockImplementation(affirm([url]));
    await followIndexLinks(searchRun({ indexLinks: new Set([url]) }), anchor);
    expect(h.ambiguous).toHaveBeenCalledWith("a1", "Grimes");
    expect(h.insertVaultSource).not.toHaveBeenCalled();
  });

  it("carries podcast identity through a profile-shaped URL into the source write", async () => {
    const url = "https://soundcloud.com/interview-show";
    const podcastEpisode = {
      podcastEpisodeKey: "publisher:show:episode-123",
      podcastShowTitle: "Interviews",
      podcastEpisodeTitle: "Grimes on her new record",
    };
    h.fetchPageContent.mockResolvedValue({ ...goodPage, podcastEpisode });
    h.ambiguous.mockResolvedValue(true);
    h.judgeSourceRelevance.mockImplementation(affirm([url]));
    await followIndexLinks(searchRun({ indexLinks: new Set([url]) }), anchor);
    expect(h.insertVaultSource).toHaveBeenCalledWith(
      expect.objectContaining({ url, type: "audio", ...podcastEpisode }),
    );
    expect(h.ambiguous).not.toHaveBeenCalled();
  });

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
      existingUrls: new Set([normalizeLoreDiscoveryUrl("https://example.com/old")]),
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
    expect(h.judgeSourceRelevance).not.toHaveBeenCalled();
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

it("does not insert a followed catalog page after its identity check exhausts the budget", async () => {
  const url = "https://www.beatport.com/artist/grimes/123";
  let now = 1000;
  const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
  try {
    h.ambiguous.mockImplementationOnce(async () => {
      now = 3000;
      return false;
    });
    h.judgeSourceRelevance.mockImplementationOnce(affirm([url]));
    await followIndexLinks(searchRun({ indexLinks: new Set([url]), deadline: 2000 }), anchor);
    expect(h.insertVaultSource).not.toHaveBeenCalled();
  } finally {
    clock.mockRestore();
  }
});
