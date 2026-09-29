import { describe, it, expect, vi, beforeEach } from "vitest";
import { captionJob } from "@/lib/research/__tests__/captionJob";
import { numberedPost } from "@/lib/credits/__tests__/post";

const m = vi.hoisted(() => ({ claimedSourceUrls: vi.fn(), saveJobState: vi.fn() }));
vi.mock("@/lib/credits/claimedSourceUrls", () => ({
  claimedSourceUrls: (...a: unknown[]) => m.claimedSourceUrls(...a),
}));
vi.mock("@/lib/research/saveJobState", () => ({
  saveJobState: (...a: unknown[]) => m.saveJobState(...a),
}));
const { captionsToRead } = await import("@/lib/research/captionsToRead");

const posts = [1, 2, 3].map(numberedPost);

beforeEach(() => {
  m.claimedSourceUrls.mockReset();
  m.saveJobState.mockReset();
});

describe("captionsToRead", () => {
  it("is every post for a full read", async () => {
    expect(await captionsToRead(captionJob({ mode: "full" }), posts, false)).toBe(posts);
    expect(m.claimedSourceUrls).not.toHaveBeenCalled();
  });

  it("writes the baseline down on the first incremental slice and skips what it covers", async () => {
    m.claimedSourceUrls.mockResolvedValueOnce(new Set([posts[0].url]));
    const job = captionJob({ mode: "incremental" });
    expect(await captionsToRead(job, posts, true)).toEqual(posts.slice(1));
    expect(job.state).toEqual({ mode: "incremental", baseline: [posts[0].url] });
    expect(m.saveJobState).toHaveBeenCalledWith("job-1", job.state);
  });

  it("filters later slices by the saved baseline, not by credits this job has since written", async () => {
    const job = captionJob({ mode: "incremental", baseline: [posts[1].url] }, 1);
    expect(await captionsToRead(job, posts, true)).toEqual([posts[0], posts[2]]);
    expect(m.claimedSourceUrls).not.toHaveBeenCalled();
    expect(m.saveJobState).not.toHaveBeenCalled();
  });
});
