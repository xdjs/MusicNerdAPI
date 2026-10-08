import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  findApprovedClaim: vi.fn(),
  getArtistDoc: vi.fn(),
  gatherDocMaterial: vi.fn(),
  toSourceList: vi.fn(),
  synthesizeArtistDoc: vi.fn(),
  generateLoreSummary: vi.fn(),
  persistRefreshedLore: vi.fn(),
}));
vi.mock("@/lib/db/db", () => ({ db: {} }));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({
  findApprovedClaim: m.findApprovedClaim,
}));
vi.mock("@/lib/lore/getArtistDoc", () => ({ getArtistDoc: m.getArtistDoc }));
vi.mock("@/lib/lore/gatherDocMaterial", () => ({ gatherDocMaterial: m.gatherDocMaterial }));
vi.mock("@/lib/lore/toSourceList", () => ({ toSourceList: m.toSourceList }));
vi.mock("@/lib/lore/synthesizeArtistDoc", () => ({ synthesizeArtistDoc: m.synthesizeArtistDoc }));
vi.mock("@/lib/lore/generateLoreSummary", () => ({ generateLoreSummary: m.generateLoreSummary }));
vi.mock("@/lib/lore/persistRefreshedLore", () => ({
  persistRefreshedLore: m.persistRefreshedLore,
}));
const { refreshArtistDoc } = await import("@/lib/lore/refreshArtistDoc");

const sources = [{ id: 1, kind: "vault", label: "L", url: "u" }];
const summary = { text: "S", sourceKey: "k" };

beforeEach(() => {
  vi.clearAllMocks();
  m.findApprovedClaim.mockResolvedValue({ id: "claim-1" });
  m.getArtistDoc.mockResolvedValue({ content: "old" });
  m.gatherDocMaterial.mockResolvedValue({});
  m.toSourceList.mockReturnValue(sources);
  m.synthesizeArtistDoc.mockResolvedValue({ doc: "## Overview\nNew.", sources });
  m.generateLoreSummary.mockResolvedValue(summary);
  m.persistRefreshedLore.mockResolvedValue(true);
});

describe("refreshArtistDoc", () => {
  it("captures ownership before synthesis and hands the job to the guarded write", async () => {
    expect(await refreshArtistDoc("a1", { createIfMissing: true, jobId: "j1" })).toBe("rebuilt");
    expect(m.findApprovedClaim.mock.invocationCallOrder[0]).toBeLessThan(
      m.synthesizeArtistDoc.mock.invocationCallOrder[0],
    );
    expect(m.persistRefreshedLore).toHaveBeenCalledWith(
      "a1",
      "## Overview\nNew.",
      sources,
      "claim-1",
      "j1",
      summary,
    );
  });

  it("uses the claim the job was queued under instead of reading it", async () => {
    await refreshArtistDoc("a1", { createIfMissing: true, jobId: "j1", expectedClaimId: null });
    expect(m.findApprovedClaim).not.toHaveBeenCalled();
    expect(m.persistRefreshedLore.mock.calls[0][3]).toBeNull();
  });

  it("is no-document when there is nothing to rebuild and it may not create one", async () => {
    m.getArtistDoc.mockResolvedValueOnce(undefined);
    expect(await refreshArtistDoc("a1")).toBe("no-document");
    expect(m.synthesizeArtistDoc).not.toHaveBeenCalled();
  });

  it("reports no readable material without asking the model or writing an empty Lore", async () => {
    m.getArtistDoc.mockResolvedValueOnce(undefined);
    m.toSourceList.mockReturnValueOnce([]);
    expect(await refreshArtistDoc("a1", { createIfMissing: true, jobId: "j1" })).toBe(
      "no-material",
    );
    expect(m.synthesizeArtistDoc).not.toHaveBeenCalled();
    expect(m.persistRefreshedLore).not.toHaveBeenCalled();
  });

  it("is cancelled when ownership changed while synthesis ran", async () => {
    m.persistRefreshedLore.mockResolvedValueOnce(false);
    expect(await refreshArtistDoc("a1", { createIfMissing: true, jobId: "j1" })).toBe("cancelled");
  });

  it("still rebuilds, keeping the old summary, when only the summary failed", async () => {
    m.generateLoreSummary.mockResolvedValueOnce(undefined);
    expect(await refreshArtistDoc("a1", { createIfMissing: true, jobId: "j1" })).toBe("rebuilt");
    expect(m.persistRefreshedLore.mock.calls[0][5]).toBeUndefined();
  });

  it("never throws: a failed synthesis is 'failed'", async () => {
    m.synthesizeArtistDoc.mockImplementationOnce(async () => {
      throw new Error("Gemini timeout");
    });
    expect(await refreshArtistDoc("a1", { createIfMissing: true })).toBe("failed");
  });
});
