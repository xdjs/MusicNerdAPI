import { describe, it, expect, vi, beforeEach } from "vitest";

const { queue } = vi.hoisted(() => ({ queue: vi.fn() }));
vi.mock("@/lib/research/queueLoreRefresh", () => ({ queueLoreRefresh: queue }));
const { refreshAfterUpload } = await import("@/lib/vaultUpload/refreshAfterUpload");

beforeEach(() => {
  queue.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("refreshAfterUpload", () => {
  it("queues a Lore refresh attributed to the uploader, with no warning", async () => {
    queue.mockResolvedValue(true);
    expect(await refreshAfterUpload("a1", "c1", "u1")).toBeUndefined();
    expect(queue).toHaveBeenCalledWith("a1", "c1", { userId: "u1", trigger: "upload" });
  });

  it("returns the retry advice when the enqueue fails, never throwing", async () => {
    queue.mockRejectedValue(new Error("queue unavailable"));
    expect(await refreshAfterUpload("a1", null, "u1")).toBe(
      "File saved. Lore refresh could not start; use Look again to retry. Do not upload the file again.",
    );
  });
});
