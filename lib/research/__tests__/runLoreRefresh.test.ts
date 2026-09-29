import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  refreshArtistDoc: vi.fn(),
  settleLoreRefresh: vi.fn(),
  saveJobProgress: vi.fn(),
  completeResearchJob: vi.fn(),
}));
vi.mock("@/lib/lore/refreshArtistDoc", () => ({ refreshArtistDoc: m.refreshArtistDoc }));
vi.mock("@/lib/research/settleLoreRefresh", () => ({ settleLoreRefresh: m.settleLoreRefresh }));
vi.mock("@/lib/research/saveJobProgress", () => ({ saveJobProgress: m.saveJobProgress }));
vi.mock("@/lib/research/completeResearchJob", () => ({
  completeResearchJob: m.completeResearchJob,
}));
const { runLoreRefresh } = await import("@/lib/research/runLoreRefresh");

const job = (state: Record<string, unknown>) => ({
  id: "job-1",
  artistId: "artist-1",
  kind: "lore_refresh" as const,
  status: "running" as const,
  cursor: 0,
  total: null,
  attempts: 0,
  state,
  updatedAt: null,
});
const plenty = () => Date.now() + 50_000;

beforeEach(() => {
  vi.clearAllMocks();
  m.refreshArtistDoc.mockResolvedValue("rebuilt");
  m.settleLoreRefresh.mockResolvedValue(true);
});

describe("runLoreRefresh", () => {
  it("waits for a slice with room for the rebuild", async () => {
    const out = await runLoreRefresh(job({ claimId: "c" }), Date.now() + 19_000);
    expect(out).toEqual({
      progress: "Waiting for a full Lore rebuild budget",
      done: false,
      waiting: true,
    });
    expect(m.saveJobProgress).toHaveBeenCalledWith("job-1", 0);
    expect(m.refreshArtistDoc).not.toHaveBeenCalled();
  });

  it("cancels a legacy job with no claim recorded", async () => {
    const out = await runLoreRefresh(job({}), plenty());
    expect(out).toEqual({
      progress: "Legacy Lore refresh cancelled; use Look again to retry",
      done: true,
    });
    expect(m.completeResearchJob).toHaveBeenCalledWith("job-1");
    expect(m.refreshArtistDoc).not.toHaveBeenCalled();
  });

  it("rebuilds under the job's claim and finishes", async () => {
    const out = await runLoreRefresh(job({ claimId: "claim-1", requestedAt: "t1" }), plenty());
    expect(m.refreshArtistDoc).toHaveBeenCalledWith("artist-1", {
      createIfMissing: true,
      jobId: "job-1",
      expectedClaimId: "claim-1",
    });
    expect(m.settleLoreRefresh).toHaveBeenCalledWith("job-1", "t1");
    expect(out).toEqual({
      progress: "Lore rebuilt from current documents and sources",
      done: true,
    });
  });

  it("passes a null claim through and settles an unrequested job with ''", async () => {
    await runLoreRefresh(job({ claimId: null }), plenty());
    expect(m.refreshArtistDoc.mock.calls[0][1].expectedClaimId).toBeNull();
    expect(m.settleLoreRefresh).toHaveBeenCalledWith("job-1", "");
  });

  it("reports a re-queue when sources changed during the rebuild", async () => {
    m.settleLoreRefresh.mockResolvedValueOnce(false);
    expect(await runLoreRefresh(job({ claimId: "c" }), plenty())).toEqual({
      progress: "Sources changed during rebuild; another refresh is queued",
      done: false,
    });
  });

  it("reports a cancellation after an ownership change", async () => {
    m.refreshArtistDoc.mockResolvedValueOnce("cancelled");
    expect(await runLoreRefresh(job({ claimId: "c" }), plenty())).toEqual({
      progress: "Lore refresh cancelled after ownership changed",
      done: true,
    });
  });

  it("throws on a failed rebuild, so the caller counts the attempt", async () => {
    m.refreshArtistDoc.mockResolvedValueOnce("failed");
    await expect(runLoreRefresh(job({ claimId: "c" }), plenty())).rejects.toThrow(
      "Could not rebuild Lore from current sources",
    );
    expect(m.settleLoreRefresh).not.toHaveBeenCalled();
  });
});
