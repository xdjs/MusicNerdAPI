import { afterEach, describe, expect, it, vi } from "vitest";
import { collectSocialScrape } from "@/lib/social/collectSocialScrape";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";
const m = vi.hoisted(() => ({ guard: vi.fn(), upsert: vi.fn(), transcript: vi.fn() }));
vi.mock("@/lib/research/withResearchJobWrite", () => ({ withResearchJobWrite: m.guard }));
vi.mock("@/lib/instagram/upsertSocialPost", () => ({ upsertSocialPost: m.upsert }));
vi.mock("@/lib/social/storeReelTranscript", () => ({ storeReelTranscript: m.transcript }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe("dataset collection", () => {
  it("holds malformed/error datasets for retry rather than calling them an empty successful feed", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => [{ error: "blocked" }] }),
    );
    expect(
      await collectSocialScrape("a", "j", { source: "x", handle: "artist", datasetId: "ds" }),
    ).toBeNull();
    expect(m.guard).not.toHaveBeenCalled();
  });
  it("does not swallow revocation or write after the job disappears", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    m.guard.mockRejectedValueOnce(new OwnershipChangedError());
    await expect(
      collectSocialScrape("a", "j", { source: "x", handle: "artist", datasetId: "ds" }),
    ).rejects.toBeInstanceOf(OwnershipChangedError);
    expect(m.upsert).not.toHaveBeenCalled();
  });
});
