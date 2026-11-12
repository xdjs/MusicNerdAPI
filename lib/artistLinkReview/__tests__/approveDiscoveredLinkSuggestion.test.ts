import { beforeEach, expect, it, vi } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";
const m = vi.hoisted(() => ({ execute: vi.fn(), context: vi.fn(), review: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute: m.execute } }));
vi.mock("@/lib/ownership/getArtistOperationOwnership", () => ({
  getArtistOperationOwnership: m.context,
}));
vi.mock("@/lib/artistLinkReview/reviewArtistLinkSuggestion", () => ({
  reviewArtistLinkSuggestion: m.review,
}));
const { approveDiscoveredLinkSuggestion } =
  await import("@/lib/artistLinkReview/approveDiscoveredLinkSuggestion");
beforeEach(() => {
  vi.resetAllMocks();
  m.context.mockReturnValue({ userId: "u1" });
  m.execute.mockResolvedValue([{ id: "g1" }]);
});
it("routes explicit confirmation through the authorized atomic review", async () => {
  expect(await approveDiscoveredLinkSuggestion("a1", "instagram", "nova")).toBe(true);
  expect(m.review).toHaveBeenCalledWith("a1", "u1", { kind: "ugc", id: "g1", decision: "approve" });
});
it("does not turn an automated operation into a user approval", async () => {
  m.context.mockReturnValue({});
  expect(await approveDiscoveredLinkSuggestion("a1", "instagram", "nova")).toBe(false);
  expect(m.execute).not.toHaveBeenCalled();
});
it("propagates a failed review instead of falling back to a direct write", async () => {
  m.review.mockRejectedValue(new Error("ownership changed"));
  await expect(approveDiscoveredLinkSuggestion("a1", "instagram", "nova")).rejects.toThrow(
    "ownership changed",
  );
});

it("reviews a reused pending user submission without changing its attribution", async () => {
  await approveDiscoveredLinkSuggestion("a1", "instagram", "nova");
  expect(renderSql(m.execute.mock.calls[0][0]).text).not.toContain("origin=");
  expect(m.review).toHaveBeenCalledWith("a1", "u1", { kind: "ugc", id: "g1", decision: "approve" });
});
