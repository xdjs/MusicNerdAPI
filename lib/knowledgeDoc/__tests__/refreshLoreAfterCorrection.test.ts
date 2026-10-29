import { describe, it, expect, vi } from "vitest";

const mock = vi.hoisted(() => ({ queue: vi.fn() }));
vi.mock("@/lib/research/queueLoreRefresh", () => ({ queueLoreRefresh: mock.queue }));
const { refreshLoreAfterCorrection } =
  await import("@/lib/knowledgeDoc/refreshLoreAfterCorrection");

describe("refreshLoreAfterCorrection", () => {
  it("queues a Lore refresh attributed to the user", async () => {
    mock.queue.mockResolvedValue(true);
    await refreshLoreAfterCorrection("a1", "c1", "u1");
    expect(mock.queue).toHaveBeenCalledWith("a1", "c1", {
      userId: "u1",
      trigger: "lore_correction",
    });
  });

  it("never fails the saved correction when the enqueue fails", async () => {
    mock.queue.mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(refreshLoreAfterCorrection("a1", null, "u1")).resolves.toBeUndefined();
  });
});
