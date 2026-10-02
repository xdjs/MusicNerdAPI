import { describe, expect, it, vi } from "vitest";
import { finishSocialIngest } from "@/lib/research/finishSocialIngest";
import { captionJob } from "@/lib/research/__tests__/captionJob";
const m = vi.hoisted(() => ({
  additional: vi.fn(),
  save: vi.fn(),
  complete: vi.fn(),
  enqueue: vi.fn(),
}));
vi.mock("@/lib/social/runAdditionalSocialResearch", () => ({
  runAdditionalSocialResearch: m.additional,
}));
vi.mock("@/lib/research/saveJobState", () => ({ saveJobState: m.save }));
vi.mock("@/lib/research/completeResearchJob", () => ({ completeResearchJob: m.complete }));
vi.mock("@/lib/research/enqueueResearchJob", () => ({ enqueueResearchJob: m.enqueue }));
describe("social research handoff", () => {
  it("waits for additional sources before caption extraction", async () => {
    m.additional.mockResolvedValueOnce({ done: false, waiting: true, progress: "Reading x" });
    expect(await finishSocialIngest(captionJob(), Date.now() + 55_000, "done")).toMatchObject({
      done: false,
    });
    expect(m.enqueue).not.toHaveBeenCalled();
  });
  it("ensures new audio reaches Lore even if incremental caption reading has nothing new", async () => {
    m.additional.mockResolvedValueOnce(null);
    const job = captionJob({
      force: true,
      additionalSocial: { tasks: [{ source: "reels", stored: 1, status: "checked" }], index: 1 },
    });
    await finishSocialIngest(job, Date.now() + 55_000, "done");
    expect(m.enqueue).toHaveBeenCalledWith("artist-1", "caption_extract", {
      parentJobId: "job-1",
      state: { incremental: true, rebuildForVideoContext: true },
    });
  });
});
