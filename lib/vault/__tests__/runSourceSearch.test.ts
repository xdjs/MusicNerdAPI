import { describe, it, expect, vi, beforeEach } from "vitest";
import { goodPage, hit } from "@/lib/vault/__tests__/searchRun";
import type { SearchRun } from "@/lib/vault/types";

const h = vi.hoisted(() => ({
  getArtistById: vi.fn(),
  adoptFromMusicBrainz: vi.fn(),
  searchCandidates: vi.fn(),
  readExistingUrls: vi.fn(),
  resolveCandidateUrls: vi.fn(async (r: unknown[]) => r),
  filterCandidates: vi.fn((_run: unknown, r: unknown[]) => r),
  readCandidates: vi.fn(),
  buildArtistAnchor: vi.fn(async () => ({ name: "Grimes", catalog: [], identifiers: [] })),
  judgeCandidates: vi.fn(async () => new Map([["https://example.com/a", "about-artist"]])),
  fileCandidate: vi.fn(
    async (_run: SearchRun, _c: unknown, _v: unknown): Promise<"stop" | void> => undefined,
  ),
  verifyAccountCandidates: vi.fn(async () => {}),
  adoptFromHubs: vi.fn(async () => {}),
  propagateRunHandles: vi.fn(async () => {}),
  followIndexLinks: vi.fn(async () => {}),
}));
vi.mock("@/lib/artists/getArtistById", () => ({ getArtistById: h.getArtistById }));
vi.mock("@/lib/vault/adoptFromMusicBrainz", () => ({
  adoptFromMusicBrainz: h.adoptFromMusicBrainz,
}));
for (const name of [
  "searchCandidates",
  "readExistingUrls",
  "resolveCandidateUrls",
  "filterCandidates",
  "readCandidates",
  "buildArtistAnchor",
  "judgeCandidates",
  "fileCandidate",
  "verifyAccountCandidates",
  "adoptFromHubs",
  "propagateRunHandles",
  "followIndexLinks",
]) {
  vi.doMock(`@/lib/vault/${name}`, () => ({ [name]: h[name as keyof typeof h] }));
}
const { runSourceSearch } = await import("@/lib/vault/runSourceSearch");

beforeEach(() => {
  h.getArtistById.mockReset().mockResolvedValue({ id: "a1", name: "Grimes", spotify: "sp1" });
  h.adoptFromMusicBrainz.mockReset().mockResolvedValue({
    handles: new Set(["grimes"]),
    homepage: "https://grimes.com",
    authoritative: false,
  });
  h.searchCandidates.mockReset().mockResolvedValue([hit("https://example.com/a")]);
  h.readExistingUrls
    .mockReset()
    .mockResolvedValue({ existingUrls: new Set(), rejectedUrls: new Set() });
  h.readCandidates
    .mockReset()
    .mockResolvedValue([{ result: hit("https://example.com/a"), page: goodPage }]);
  h.fileCandidate.mockReset().mockImplementation(async run => {
    run.saved.push({ id: "s1" } as never);
  });
  for (const f of [
    h.verifyAccountCandidates,
    h.adoptFromHubs,
    h.propagateRunHandles,
    h.followIndexLinks,
  ])
    f.mockClear();
});

describe("runSourceSearch", () => {
  it("runs the phases in order and returns what it saved", async () => {
    const saved = await runSourceSearch("a1", {});
    expect(saved).toEqual([{ id: "s1" }]);
    expect(h.adoptFromMusicBrainz).toHaveBeenCalledWith(
      "a1",
      "Grimes",
      expect.objectContaining({ id: "a1" }),
    );
    expect(h.searchCandidates).toHaveBeenCalledWith(expect.anything(), "https://grimes.com");
    const run = h.fileCandidate.mock.calls[0][0];
    // MusicBrainz's curated handles seed the verified set.
    expect([...run.verifiedHandles]).toEqual(["grimes"]);
    expect(h.fileCandidate).toHaveBeenCalledWith(run, expect.anything(), "about-artist");
    expect(h.propagateRunHandles).toHaveBeenCalledWith(run, false);
    expect(h.followIndexLinks).toHaveBeenCalledWith(
      run,
      expect.objectContaining({ name: "Grimes" }),
    );
  });

  it("finds nothing for a missing artist or an empty search", async () => {
    h.getArtistById.mockResolvedValueOnce(undefined);
    expect(await runSourceSearch("a1", {})).toEqual([]);
    h.searchCandidates.mockResolvedValueOnce([]);
    expect(await runSourceSearch("a1", { requireComplete: true })).toEqual([]);
    expect(h.readCandidates).not.toHaveBeenCalled();
  });

  it("stops filing when out of time", async () => {
    h.readCandidates.mockResolvedValueOnce([
      { result: hit("https://example.com/a"), page: goodPage },
      { result: hit("https://example.com/b"), page: goodPage },
    ]);
    h.fileCandidate.mockResolvedValueOnce("stop");
    await runSourceSearch("a1", {});
    expect(h.fileCandidate).toHaveBeenCalledTimes(1);
  });

  it("throws for a durable run and swallows for a best-effort one", async () => {
    h.readCandidates.mockRejectedValue(new Error("boom"));
    await expect(runSourceSearch("a1", { requireComplete: true })).rejects.toThrow("boom");
    expect(await runSourceSearch("a1", {})).toEqual([]);
  });

  it("won't start MusicBrainz or the search after the deadline", async () => {
    await expect(
      runSourceSearch("a1", { requireComplete: true, deadline: Date.now() - 1 }),
    ).rejects.toThrow("Source search deadline exhausted before MusicBrainz");
    expect(await runSourceSearch("a1", { deadline: Date.now() - 1 })).toEqual([]);
    expect(h.adoptFromMusicBrainz).not.toHaveBeenCalled();
    expect(h.searchCandidates).not.toHaveBeenCalled();
  });
});
