import { describe, it, expect, vi, beforeEach } from "vitest";
import { captionJob } from "@/lib/research/__tests__/captionJob";

const m = vi.hoisted(() => ({
  claimedSourceUrls: vi.fn(),
  saveJobState: vi.fn(),
  clearSocialCredits: vi.fn(),
}));
vi.mock("@/lib/credits/claimedSourceUrls", () => ({
  claimedSourceUrls: (...a: unknown[]) => m.claimedSourceUrls(...a),
}));
vi.mock("@/lib/credits/clearSocialCredits", () => ({
  clearSocialCredits: (...a: unknown[]) => m.clearSocialCredits(...a),
}));
vi.mock("@/lib/research/saveJobState", () => ({
  saveJobState: (...a: unknown[]) => m.saveJobState(...a),
}));
const { resolveExtractionMode } = await import("@/lib/research/resolveExtractionMode");

beforeEach(() => {
  for (const f of Object.values(m)) f.mockReset();
  m.claimedSourceUrls.mockResolvedValue(new Set());
});

describe("resolveExtractionMode", () => {
  it("reads in full, clearing old credits, when the artist has none", async () => {
    const job = captionJob();
    expect(await resolveExtractionMode(job)).toBe(false);
    expect(job.state).toEqual({ mode: "full" });
    expect(m.saveJobState).toHaveBeenCalledWith("job-1", { mode: "full" });
    expect(m.clearSocialCredits).toHaveBeenCalledWith("artist-1", "job-1");
  });

  it("reads incrementally, keeping credits we hold, when the artist already has some", async () => {
    m.claimedSourceUrls.mockResolvedValueOnce(new Set(["u"]));
    const job = captionJob();
    expect(await resolveExtractionMode(job)).toBe(true);
    expect(job.state).toEqual({ mode: "incremental" });
    expect(m.clearSocialCredits).not.toHaveBeenCalled();
  });

  it("honours an explicit incremental job and an explicit full rebuild", async () => {
    expect(await resolveExtractionMode(captionJob({ incremental: true }))).toBe(true);
    m.claimedSourceUrls.mockResolvedValueOnce(new Set(["u"]));
    expect(await resolveExtractionMode(captionJob({ fullRebuild: true }))).toBe(false);
    expect(m.clearSocialCredits).toHaveBeenCalledTimes(1);
  });

  it("is decided once: later slices read the mode written on the job", async () => {
    expect(await resolveExtractionMode(captionJob({ mode: "incremental" }, 3))).toBe(true);
    expect(await resolveExtractionMode(captionJob({ mode: "full" }, 3))).toBe(false);
    // A job at cursor > 0 with no mode (written before modes existed) is full.
    expect(await resolveExtractionMode(captionJob({}, 3))).toBe(false);
    expect(m.claimedSourceUrls).not.toHaveBeenCalled();
    expect(m.saveJobState).not.toHaveBeenCalled();
  });
});
