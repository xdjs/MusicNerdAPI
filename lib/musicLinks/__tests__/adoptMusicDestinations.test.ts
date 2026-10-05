import { adoptMusicDestinations } from "../adoptMusicDestinations";
import { beforeEach, expect, it, vi } from "vitest";
import { searchRun } from "@/lib/vault/__tests__/searchRun";
const m = vi.hoisted(() => ({ fetch: vi.fn(), insert: vi.fn(), ambiguous: vi.fn() }));
vi.mock("@/lib/pages/fetchPageContent", () => ({ fetchPageContent: m.fetch }));
vi.mock("@/lib/vault/insertVaultSource", () => ({ insertVaultSource: m.insert }));
vi.mock("@/lib/identity/nameIsAmbiguousInDirectory", () => ({
  nameIsAmbiguousInDirectory: m.ambiguous,
}));
const apple = "https://music.apple.com/us/artist/grimes/123";
const beatport = "https://www.beatport.com/artist/grimes/456";
beforeEach(() => {
  m.fetch
    .mockReset()
    .mockResolvedValue({ status: 200, title: "Grimes", extractedText: "Grimes ".repeat(100) });
  m.insert.mockReset().mockImplementation(async data => ({ id: data.url, ...data }));
  m.ambiguous.mockReset().mockResolvedValue(false);
});
it("retains MusicBrainz catalog URLs as reviewable original URLs", async () => {
  const run = searchRun();
  await adoptMusicDestinations(run, [apple, beatport], "identifier");
  expect(m.insert.mock.calls.map(([data]) => [data.url, data.type, data.status])).toEqual([
    [apple, "music", "pending"],
    [beatport, "music", "pending"],
  ]);
  expect(run.saved).toHaveLength(2);
});
it("does not adopt a namesake, dead page, non-artist catalog page or ambiguous platform", async () => {
  const run = searchRun();
  m.fetch
    .mockResolvedValueOnce({ status: 200, title: "Someone Else" })
    .mockResolvedValueOnce({ status: 404, title: "Grimes" });
  await adoptMusicDestinations(
    run,
    [apple, beatport, "https://music.apple.com/album/release/999"],
    "own-page",
  );
  expect(m.insert).not.toHaveBeenCalled();
  m.ambiguous.mockResolvedValueOnce(true);
  await adoptMusicDestinations(run, [apple], "name");
  expect(m.insert).not.toHaveBeenCalled();
  m.ambiguous.mockResolvedValue(false);
  await adoptMusicDestinations(run, [apple, "https://music.apple.com/artist/999"], "identifier");
  expect(m.insert).not.toHaveBeenCalled();
});
it("preserves rejected/existing URLs and source-write skips, and checks the deadline after the fetch", async () => {
  const run = searchRun({ existingUrls: new Set([apple.replace("https://", "")]) });
  await adoptMusicDestinations(run, [apple], "identifier");
  expect(m.fetch).not.toHaveBeenCalled();
  m.insert.mockResolvedValueOnce(undefined);
  await adoptMusicDestinations(run, [beatport], "identifier");
  expect(run.saved).toHaveLength(0);
  const expired = searchRun();
  m.fetch.mockImplementationOnce(async () => {
    expired.deadline = Date.now() - 1;
    return { status: 200, title: "Grimes" };
  });
  m.insert.mockClear();
  await adoptMusicDestinations(expired, [apple], "identifier");
  expect(m.insert).not.toHaveBeenCalled();
});
it("propagates failed writes for durable jobs instead of silently losing the candidate", async () => {
  m.insert.mockRejectedValueOnce(new Error("write failed"));
  await expect(
    adoptMusicDestinations(searchRun({ requireComplete: true }), [apple], "identifier"),
  ).rejects.toThrow("write failed");
});
