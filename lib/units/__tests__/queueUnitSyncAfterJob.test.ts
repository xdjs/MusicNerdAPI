import { beforeEach, describe, expect, it, vi } from "vitest";

const queue = vi.hoisted(() => vi.fn());
vi.mock("@/lib/units/queueUnitSync", () => ({ queueUnitSync: queue }));
const { queueUnitSyncAfterJob } = await import("@/lib/units/queueUnitSyncAfterJob");

const job = (kind: string) => ({ id: "j1", artistId: "a1", kind }) as never;
const done = { progress: "x", done: true };

beforeEach(() => {
  queue.mockReset().mockResolvedValue(true);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("queueUnitSyncAfterJob", () => {
  it.each([
    "source_extract",
    "social_ingest",
    "caption_extract",
    "question_research",
    "lore_refresh",
  ])("queues a unit_sync for the artist when a %s job finishes", async kind => {
    await queueUnitSyncAfterJob(job(kind), done);
    expect(queue).toHaveBeenCalledWith("a1");
  });

  it.each([
    "unit_sync",
    "latest_refresh",
    "source_search",
    "spotify_match",
    "catalog_match",
    "interview_prepare",
  ])("does nothing after a %s job", async kind => {
    await queueUnitSyncAfterJob(job(kind), done);
    expect(queue).not.toHaveBeenCalled();
  });

  it("does nothing while the job is still going", async () => {
    await queueUnitSyncAfterJob(job("source_extract"), { progress: "x", done: false });
    expect(queue).not.toHaveBeenCalled();
  });

  it("swallows a queue failure with a name-only warning", async () => {
    queue.mockRejectedValue(
      Object.assign(new Error("Failed query: params: secret"), { name: "DrizzleQueryError" }),
    );
    await expect(queueUnitSyncAfterJob(job("lore_refresh"), done)).resolves.toBeUndefined();
    const logged = vi.mocked(console.warn).mock.calls.flat().join(" ");
    expect(logged).toContain("DrizzleQueryError");
    expect(logged).not.toContain("secret");
  });
});
