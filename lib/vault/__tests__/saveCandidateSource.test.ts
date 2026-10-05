import { describe, it, expect, vi, beforeEach } from "vitest";
import { GOOD_BODY, goodPage, hit, searchRun } from "@/lib/vault/__tests__/searchRun";

vi.mock("@/lib/identity/nameIsAmbiguousInDirectory", () => ({
  nameIsAmbiguousInDirectory: vi.fn(async () => false),
}));

const { insertVaultSource } = vi.hoisted(() => ({ insertVaultSource: vi.fn() }));
vi.mock("@/lib/vault/insertVaultSource", () => ({ insertVaultSource }));
const { saveCandidateSource } = await import("@/lib/vault/saveCandidateSource");

beforeEach(() => {
  insertVaultSource.mockReset().mockImplementation(async row => ({ id: "s1", url: row.url }));
});
const save = (
  run: ReturnType<typeof searchRun>,
  url: string,
  page: object,
  verdict = "undecided",
  title?: string,
) => saveCandidateSource(run, { result: hit(url, title), page: page as never }, verdict as never);

describe("saveCandidateSource", () => {
  it("stores a verified page with the page's own content", async () => {
    const run = searchRun();
    await save(run, "https://example.com/a", {
      ...goodPage,
      publishedAt: "2019-01-10",
      ogImage: "i",
    });
    expect(insertVaultSource).toHaveBeenCalledWith(
      expect.objectContaining({
        artistId: "a1",
        url: "https://example.com/a",
        title: "A",
        snippet: "s",
        type: "article",
        status: "pending",
        extractedText: GOOD_BODY,
        ogImage: "i",
        publishedAt: "2019-01-10",
      }),
    );
    expect(run.saved).toHaveLength(1);
  });

  it("keeps a bot-blocked page as an uncitable lead", async () => {
    await save(searchRun(), "https://example.com/blocked", {
      title: "",
      extractedText: null,
      status: 403,
    });
    expect(insertVaultSource.mock.calls[0][0]).toMatchObject({
      extractedText: null,
      title: "A Grimes Interview",
    });
  });

  it("drops a dead page, an XML document, and an unreadable page whose title is someone else", async () => {
    const run = searchRun();
    await save(run, "https://example.com/gone", { title: "", extractedText: null, status: 404 });
    await save(run, "https://example.com/x", {
      ...goodPage,
      fullText: '<?xml version="1.0"?><rss/>',
    });
    await save(
      run,
      "https://blogcritics.org/pete-seeger",
      { title: "", extractedText: "", status: 403 },
      "undecided",
      "Music Review: Pete Seeger",
    );
    expect(insertVaultSource).not.toHaveBeenCalled();
    expect(run.counts.dropped).toBe(3);
  });

  it("demotes a namesake to a lead unless the judge affirmed it or it's their own domain", async () => {
    const RAPPER = "Dave talks about his song Black and growing up in south London. ".repeat(20);
    const page = {
      title: "Dave",
      snippet: "s",
      extractedText: RAPPER,
      fullText: RAPPER,
      status: 200,
    };
    const run = searchRun({ artistName: "Black Dave" });
    await save(run, "https://theguardian.com/dave", page);
    expect(insertVaultSource.mock.calls[0][0].extractedText).toBeNull();
    await save(run, "https://theguardian.com/dave2", page, "about-artist");
    expect(insertVaultSource.mock.calls[1][0].extractedText).toBe(RAPPER);
  });

  it("stops without inserting when out of time, and rethrows a failed write for a durable run", async () => {
    expect(
      await save(searchRun({ deadline: Date.now() - 1 }), "https://example.com/a", goodPage),
    ).toBe("stop");
    expect(insertVaultSource).not.toHaveBeenCalled();
    insertVaultSource.mockRejectedValue(new Error("source database unavailable"));
    await expect(
      save(searchRun({ requireComplete: true }), "https://example.com/a", goodPage),
    ).rejects.toThrow("source database unavailable");
    await expect(save(searchRun(), "https://example.com/a", goodPage)).resolves.toBeUndefined();
  });
});

it("routes a verified catalog artist/release page as music and never trusts a title-only catalog lead", async () => {
  await save(searchRun(), "https://www.beatport.com/artist/grimes/123", goodPage, "about-artist");
  expect(insertVaultSource).toHaveBeenLastCalledWith(
    expect.objectContaining({ type: "music", status: "pending" }),
  );
  await save(
    searchRun(),
    "https://music.apple.com/us/album/a-record/456",
    goodPage,
    "about-artist",
  );
  expect(insertVaultSource).toHaveBeenLastCalledWith(expect.objectContaining({ type: "music" }));
  insertVaultSource.mockClear();
  await save(searchRun(), "https://music.apple.com/us/artist/grimes/123", goodPage, "undecided");
  expect(insertVaultSource).not.toHaveBeenCalled();
});
it("uses website for the verified artist homepage and data for Discogs releases", async () => {
  await save(searchRun(), "https://grimes.com/", goodPage, "about-artist");
  expect(insertVaultSource).toHaveBeenLastCalledWith(expect.objectContaining({ type: "website" }));
  await save(searchRun(), "https://www.discogs.com/master/123-record", goodPage, "about-artist");
  expect(insertVaultSource).toHaveBeenLastCalledWith(expect.objectContaining({ type: "data" }));
});
