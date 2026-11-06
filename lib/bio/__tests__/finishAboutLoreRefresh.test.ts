import { beforeEach, expect, it, vi } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";
const execute = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/db", () => ({
  db: { execute, transaction: (fn: (tx: unknown) => unknown) => fn({ execute }) },
}));
const { finishAboutLoreRefresh } = await import("../finishAboutLoreRefresh");
const lease = { jobId: "j", claimedAt: "2026-11-03T00:00:00Z", requestedAt: "r" };
beforeEach(() => {
  execute.mockReset().mockResolvedValue([{ status: "done" }]);
});
it("settles only the exact running lease and preserves a newer request", async () => {
  expect(await finishAboutLoreRefresh("a", lease, "rebuilt")).toBe(true);
  const q = renderSql(execute.mock.calls[1][0]);
  expect(q.text).toContain("status='running'");
  expect(q.text).toContain("claimed_at=");
  expect(q.text).toContain("state->>'requestedAt'");
  expect(q.params).toEqual(expect.arrayContaining(["a", "j", lease.claimedAt, "r"]));
});
it("does not claim completion after losing the lease", async () => {
  execute.mockResolvedValue([]);
  expect(await finishAboutLoreRefresh("a", lease, "rebuilt")).toBe(false);
});
it("propagates cleanup errors to the caller", async () => {
  execute.mockRejectedValue(new Error("offline"));
  await expect(finishAboutLoreRefresh("a", lease, "failed")).rejects.toThrow("offline");
});
