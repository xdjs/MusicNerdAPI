import { beforeEach, expect, it, vi } from "vitest";
import { fakeTransaction } from "./fakeTransaction";
const m = vi.hoisted(() => ({ transaction: vi.fn(), context: vi.fn(), lock: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { transaction: m.transaction } }));
vi.mock("@/lib/ownership/getArtistOperationOwnership", () => ({
  getArtistOperationOwnership: m.context,
}));
vi.mock("@/lib/ownership/lockScopedArtistWrite", () => ({ lockScopedArtistWrite: m.lock }));
const { saveDiscoveredLinkSuggestion } =
  await import("@/lib/artistLinkReview/saveDiscoveredLinkSuggestion");
const candidate = {
  siteName: "instagram",
  value: "nova",
  profileUrl: "https://instagram.com/nova",
};
beforeEach(() => {
  vi.resetAllMocks();
  m.context.mockReturnValue({ artistId: "a1", expectedClaimId: null });
});
it("requires an authorized operation before writing", async () => {
  m.context.mockReturnValue(undefined);
  await expect(saveDiscoveredLinkSuggestion("a1", candidate)).rejects.toThrow(
    "Artist operation required",
  );
  expect(m.transaction).not.toHaveBeenCalled();
});
it("does not resurrect an existing rejected or approved suggestion", async () => {
  const tx = fakeTransaction([[{ id: "old", accepted: false, date_processed: "2026-11-01" }]]);
  m.transaction.mockImplementation(fn => fn(tx));
  expect(await saveDiscoveredLinkSuggestion("a1", candidate)).toBe(false);
  expect(m.lock).toHaveBeenCalledWith(tx, "a1");
  expect(tx.statements()).toHaveLength(1);
  expect(tx.statements()[0].text).not.toContain("date_processed is null");
});
it("stores a new candidate as unapproved automated research without claiming a user submitted it", async () => {
  const tx = fakeTransaction([[], []]);
  m.transaction.mockImplementation(fn => fn(tx));
  await saveDiscoveredLinkSuggestion("a1", candidate);
  const insert = tx.statements()[1];
  expect(insert.text).toContain("insert into ugcresearch");
  expect(insert.text).toContain("'research',false");
  expect(insert.params).toEqual(["a1", candidate.profileUrl, "instagram", "nova"]);
});
it("stops before persistence if ownership changed", async () => {
  const tx = fakeTransaction([]);
  m.transaction.mockImplementation(fn => fn(tx));
  m.lock.mockRejectedValue(new Error("ownership changed"));
  await expect(saveDiscoveredLinkSuggestion("a1", candidate)).rejects.toThrow("ownership changed");
  expect(tx.statements()).toHaveLength(0);
});
