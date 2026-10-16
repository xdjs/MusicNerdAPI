import { beforeEach, describe, expect, it, vi } from "vitest";
import { hit, searchRun } from "@/lib/vault/__tests__/searchRun";
import type { DiscoveryResult, SearchRun } from "@/lib/vault/types";

const h = vi.hoisted(() => ({
  search: vi.fn(),
  match: vi.fn(),
  process: vi.fn(),
  verify: vi.fn(),
}));
vi.mock("@/lib/vault/searchMissingYouTubeChannels", () => ({
  searchMissingYouTubeChannels: h.search,
}));
vi.mock("@/lib/vault/accountMatchFor", () => ({ accountMatchFor: h.match }));
vi.mock("@/lib/vault/processDiscoveryCandidates", () => ({
  processDiscoveryCandidates: h.process,
}));
vi.mock("@/lib/vault/verifyAccountCandidates", () => ({ verifyAccountCandidates: h.verify }));
const { discoverMissingYouTubeChannel } = await import("@/lib/vault/discoverMissingYouTubeChannel");
const anchor = { name: "Grimes" };
const channel = (id: string) => hit(`https://youtube.com/channel/${id}`);

beforeEach(() => {
  h.search.mockReset().mockResolvedValue([]);
  h.match.mockReset().mockImplementation(async (url: string) => {
    const id = new URL(url).pathname.match(/^\/channel\/([^/]+)$/)?.[1];
    return { isAccountUrl: !!id, match: id ? { siteName: "youtubechannel", id } : null };
  });
  h.process.mockReset().mockResolvedValue(undefined);
  h.verify.mockReset().mockResolvedValue(undefined);
});

describe("discoverMissingYouTubeChannel", () => {
  it("waits for verification before trying the next query, then stops after a saved channel", async () => {
    const run = searchRun();
    h.search
      .mockResolvedValueOnce([channel("UCreviewer")])
      .mockResolvedValueOnce([channel("UCofficial")]);
    h.verify
      .mockImplementationOnce(async () => {})
      .mockImplementationOnce(async () => {
        run.artist.youtubechannel = "UCofficial";
      });
    await discoverMissingYouTubeChannel(run, new Set(), anchor);
    expect(h.search.mock.calls.map(([, round]) => round)).toEqual([0, 1]);
    expect(h.verify.mock.invocationCallOrder[0]).toBeLessThan(h.search.mock.invocationCallOrder[1]);
    expect(h.process).toHaveBeenCalledTimes(2);
  });

  it("uses at most three queries even when every candidate fails verification", async () => {
    h.search.mockImplementation(async (_run: SearchRun, round: number) => [channel(`UC${round}`)]);
    await discoverMissingYouTubeChannel(searchRun(), new Set(), anchor);
    expect(h.search.mock.calls.map(([, round]) => round)).toEqual([0, 1, 2]);
    expect(h.verify).toHaveBeenCalledTimes(3);
  });

  it("does not query when broad discovery already saved either non-provisional YouTube slot", async () => {
    await discoverMissingYouTubeChannel(
      searchRun({ artist: { youtube: "already-saved" } }),
      new Set(),
      anchor,
    );
    await discoverMissingYouTubeChannel(
      searchRun({ artist: { youtubechannel: "UCsaved" } }),
      new Set(),
      anchor,
    );
    expect(h.search).not.toHaveBeenCalled();
  });

  it("filters videos and duplicates before channel reads, retains article leads, and respects ten reads across rounds", async () => {
    const article = hit("https://magazine.example/interview");
    const video = hit("https://youtube.com/watch?v=video");
    const run = searchRun();
    h.search
      .mockResolvedValueOnce([
        article,
        video,
        ...Array.from({ length: 7 }, (_, i) => channel(`UC${i}`)),
      ])
      .mockResolvedValueOnce([
        article,
        channel("UC0"),
        ...Array.from({ length: 7 }, (_, i) => channel(`UC${i + 7}`)),
      ]);
    const articles = await discoverMissingYouTubeChannel(run, new Set(), anchor);
    expect(articles).toEqual([{ ...article, type: "interview" }]);
    const reads = h.process.mock.calls.flatMap(([, results]) => results as DiscoveryResult[]);
    expect(reads.map(row => row.url)).toEqual(
      Array.from({ length: 10 }, (_, i) => channel(`UC${i}`).url),
    );
    expect(h.search).toHaveBeenCalledTimes(2);
  });

  it("does not spend more search calls after the shared account-check budget is exhausted", async () => {
    const run = searchRun({
      checkedAccountCandidates: new Set(
        Array.from({ length: 10 }, (_, i) => `youtubechannel:UC${i}`),
      ),
    });
    await discoverMissingYouTubeChannel(run, new Set(), anchor);
    expect(h.search).not.toHaveBeenCalled();
  });

  it("honors the durable deadline before searching and does not hide provider failure", async () => {
    await expect(
      discoverMissingYouTubeChannel(
        searchRun({ deadline: Date.now() - 1, requireComplete: true }),
        new Set(),
        anchor,
      ),
    ).rejects.toThrow("deadline");
    expect(h.search).not.toHaveBeenCalled();
    h.search.mockRejectedValue(new Error("provider unavailable"));
    await expect(
      discoverMissingYouTubeChannel(searchRun({ requireComplete: true }), new Set(), anchor),
    ).rejects.toThrow("provider unavailable");
    expect(h.search).toHaveBeenCalledTimes(1);
  });
});
