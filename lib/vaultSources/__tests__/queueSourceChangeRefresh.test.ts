import { describe, it, expect, vi, beforeEach } from "vitest";

const { queue } = vi.hoisted(() => ({ queue: vi.fn() }));
vi.mock("@/lib/research/queueLoreRefresh", () => ({ queueLoreRefresh: queue }));
const { queueSourceChangeRefresh } = await import("@/lib/vaultSources/queueSourceChangeRefresh");

beforeEach(() => vi.clearAllMocks());

describe("queueSourceChangeRefresh", () => {
  it("queues a source_change refresh under the claim, as the user", async () => {
    await queueSourceChangeRefresh("a1", "c1", "u1");
    expect(queue).toHaveBeenCalledWith("a1", "c1", { userId: "u1", trigger: "source_change" });
  });

  it("logs and swallows a failed enqueue", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    queue.mockRejectedValueOnce(new Error("pool"));
    await expect(queueSourceChangeRefresh("a1", null, "u1")).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
