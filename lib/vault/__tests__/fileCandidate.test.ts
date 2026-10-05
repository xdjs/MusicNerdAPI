import { describe, it, expect, vi, beforeEach } from "vitest";
import { goodPage, hit, searchRun } from "@/lib/vault/__tests__/searchRun";

const { accountMatchFor, adoptJudgedAccount, saveCandidateSource } = vi.hoisted(() => ({
  accountMatchFor: vi.fn(),
  adoptJudgedAccount: vi.fn(async () => false),
  saveCandidateSource: vi.fn(async () => undefined),
}));
vi.mock("@/lib/vault/accountMatchFor", () => ({ accountMatchFor }));
vi.mock("@/lib/vault/adoptJudgedAccount", () => ({ adoptJudgedAccount }));
vi.mock("@/lib/vault/saveCandidateSource", () => ({ saveCandidateSource }));
const { fileCandidate } = await import("@/lib/vault/fileCandidate");

const none = { match: null, isAccountUrl: false };
beforeEach(() => {
  accountMatchFor.mockReset().mockResolvedValue(none);
  adoptJudgedAccount.mockReset().mockResolvedValue(false);
  saveCandidateSource.mockReset().mockResolvedValue(undefined);
});
const file = (
  run: ReturnType<typeof searchRun>,
  url: string,
  page: object,
  verdict = "undecided",
) =>
  fileCandidate(
    run,
    { result: hit(url), page: { ...goodPage, ...page } as never },
    verdict as never,
  );

describe("fileCandidate", () => {
  it("does not use an unreadable homepage as an account or outbound-link authority", async () => {
    const run = searchRun();
    await fileCandidate(
      run,
      {
        result: { ...hit("https://grimes.com/"), type: "website" },
        page: {
          ...goodPage,
          extractedText: "Grimes",
          fullText: "Grimes",
          outboundLinks: ["https://instagram.com/attacker"],
        },
      },
      "about-artist",
    );
    expect(run.hubCandidates).toEqual([]);
    expect(accountMatchFor).not.toHaveBeenCalled();
    expect(saveCandidateSource).not.toHaveBeenCalled();
    expect(run.counts.dropped).toBe(1);
  });

  it("routes an adopted account to links, not the vault", async () => {
    const x = { siteName: "x", cardPlatformName: "X", id: "p3t3rango" };
    accountMatchFor.mockResolvedValue({ match: x, isAccountUrl: true });
    adoptJudgedAccount.mockResolvedValue(true);
    const run = searchRun();
    await file(run, "https://x.com/p3t3rango", {}, "about-artist");
    expect(adoptJudgedAccount).toHaveBeenCalledWith(
      run,
      x,
      "https://x.com/p3t3rango",
      "about-artist",
    );
    expect(saveCandidateSource).not.toHaveBeenCalled();
    expect(run.counts.skipped).toBe(1);
  });

  it("holds a page's outbound links for the hub pass, unless it's an index", async () => {
    const run = searchRun();
    await file(
      run,
      "https://dupes.rocks",
      { outboundLinks: ["https://instagram.com/x"] },
      "about-artist",
    );
    await file(
      run,
      "https://label.com/roster",
      { outboundLinks: ["https://instagram.com/y"] },
      "lists-artist",
    );
    expect(run.hubCandidates).toEqual([
      { links: ["https://instagram.com/x"], url: "https://dupes.rocks", aboutArtist: true },
    ]);
  });

  it.each(["not-about-artist", "undecided"])(
    "does not queue a %s page as an outbound identity authority",
    async verdict => {
      const run = searchRun();
      await file(
        run,
        "https://attacker.example/artist",
        {
          outboundLinks: [
            "https://soundcloud.com/grimes",
            "https://music.apple.com/artist/grimes/42",
          ],
        },
        verdict,
      );
      expect(run.hubCandidates).toEqual([]);
    },
  );

  it("keeps an unadopted account page as a candidate handle, never as press", async () => {
    accountMatchFor.mockResolvedValue({
      match: { siteName: "instagram", cardPlatformName: null, id: "p3t3rango" },
      isAccountUrl: true,
    });
    const run = searchRun();
    await file(run, "https://instagram.com/p3t3rango", {
      title: "Pete Rango (@p3t3rango)",
      snippet: "bio",
    });
    expect(run.accountCandidates).toEqual([
      {
        siteName: "instagram",
        id: "p3t3rango",
        url: "https://instagram.com/p3t3rango",
        title: "Pete Rango (@p3t3rango)",
        description: "bio",
      },
    ]);
    expect(saveCandidateSource).not.toHaveBeenCalled();
  });

  it("drops a page about someone else, and harvests an index page's links instead of storing it", async () => {
    const run = searchRun();
    await file(run, "https://head-fi.org/chord-dave", {}, "not-about-artist");
    await file(
      run,
      "https://rvamag.com/tags/grimes",
      { links: ["https://rvamag.com/story"] },
      "lists-artist",
    );
    expect(saveCandidateSource).not.toHaveBeenCalled();
    expect(run.counts.dropped).toBe(2);
    expect([...run.indexLinks]).toEqual(["https://rvamag.com/story"]);
  });

  it("saves anything else, passing on a stop", async () => {
    saveCandidateSource.mockResolvedValueOnce("stop" as never);
    expect(await file(searchRun(), "https://example.com/a", {})).toBe("stop");
    expect(saveCandidateSource).toHaveBeenCalledTimes(1);
  });
});
