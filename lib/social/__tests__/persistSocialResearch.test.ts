import { describe, expect, it, vi } from "vitest";
import { persistSocialResearch } from "@/lib/social/persistSocialResearch";
const guard = vi.hoisted(() => vi.fn());
vi.mock("@/lib/research/withResearchJobWrite", () => ({ withResearchJobWrite: guard }));
describe("paid-run state persistence", () => {
  it("does not swallow database errors that would lose the paid run id", async () => {
    guard.mockRejectedValueOnce(new Error("pool"));
    await expect(
      persistSocialResearch({ id: "j", artistId: "a", state: { paid: "run" } }, true),
    ).rejects.toThrow("pool");
  });
});
