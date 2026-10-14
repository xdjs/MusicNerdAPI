import { beforeEach, it, expect, vi } from "vitest";
import { captionJob } from "./captionJob";
import { saveSocialJobProgress } from "../saveSocialJobProgress";
import { failSocialJob } from "../failSocialJob";
import { assertSocialJobActive } from "../assertSocialJobActive";
const m = vi.hoisted(() => ({
  guard: vi.fn(),
  execute: vi.fn(),
  save: vi.fn(),
  fail: vi.fn(),
  failCursor: vi.fn(),
}));
vi.mock("@/lib/research/withResearchJobWrite", () => ({ withResearchJobWrite: m.guard }));
vi.mock("@/lib/research/saveJobProgress", () => ({ saveJobProgress: m.save }));
vi.mock("@/lib/research/failResearchJob", () => ({ failResearchJob: m.fail }));
vi.mock("@/lib/research/failJobAtCursor", () => ({ failJobAtCursor: m.failCursor }));
beforeEach(() => {
  Object.values(m).forEach(fn => fn.mockReset());
  m.guard.mockImplementation(async (_a, _j, fn) => fn({ execute: m.execute }));
});
it.each([{ directoryActivityId: "event" }, { resumedFromDirectoryJobId: "old", claimId: "claim" }])(
  "guarded progress and failure cannot resurrect a retired worker %j",
  async state => {
    const job = captionJob(state);
    m.guard.mockRejectedValue(new Error("ownership changed"));
    await expect(saveSocialJobProgress(job, 3, { state })).rejects.toThrow("ownership changed");
    await expect(failSocialJob(job, "failure", { cursor: 3, total: 4, state })).rejects.toThrow(
      "ownership changed",
    );
    await expect(assertSocialJobActive(job)).rejects.toThrow("ownership changed");
    expect(m.execute).not.toHaveBeenCalled();
    expect(m.save).not.toHaveBeenCalled();
    expect(m.fail).not.toHaveBeenCalled();
    expect(m.failCursor).not.toHaveBeenCalled();
  },
);
it("an authorized descendant persists progress and bounded failures within its guard", async () => {
  const job = captionJob({ directoryActivityId: "event" });
  await saveSocialJobProgress(job, 3);
  await failSocialJob(job, "failure");
  expect(m.guard).toHaveBeenCalledTimes(2);
  expect(m.execute).toHaveBeenCalledTimes(2);
});
it("ordinary existing jobs retain their progress and retry paths", async () => {
  const job = captionJob();
  await saveSocialJobProgress(job, 3);
  await failSocialJob(job, "failure");
  expect(m.save).toHaveBeenCalledWith(job.id, 3, undefined);
  expect(m.fail).toHaveBeenCalledWith(job.id, "failure");
  expect(m.guard).not.toHaveBeenCalled();
});
