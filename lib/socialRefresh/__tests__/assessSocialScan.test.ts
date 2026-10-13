import { it, expect } from "vitest";
import { assessSocialScan } from "../assessSocialScan";
const points = [
  { id: "3", postedAt: "2026-10-09T00:00:00Z" },
  { id: "2", postedAt: "2026-10-08T00:00:00Z" },
];
const first = { startedAt: "2026-10-10T00:00:00Z" };
it("bootstraps a bounded recent reference without claiming complete history", () => {
  const result = assessSocialScan(first, points, true);
  expect(result.connected).toBe(false);
  expect(result.reference.anchors).toEqual(points);
});
it("reconnects a capped run when every saved anchor was reached", () => {
  const reference = assessSocialScan(first, points, true).reference;
  const result = assessSocialScan(
    { ...first, reference, providerLimited: true },
    [{ id: "4", postedAt: "2026-10-10T00:00:00Z" }, ...points],
    true,
  );
  expect(result.connected).toBe(true);
  expect(result.reference.gapSince).toBeNull();
});
it("retains the old reference and gap if cap or deleted posts prevent reconnection", () => {
  const reference = assessSocialScan(first, points, true).reference;
  const result = assessSocialScan({ ...first, reference }, [points[0]], true);
  expect(result.connected).toBe(false);
  expect(result.reference.anchors).toEqual(points);
  expect(result.reference.gapSince).toBe(first.startedAt);
});
it("empty or malformed results cannot bootstrap or advance a reference", () => {
  expect(assessSocialScan(first, [], true).reference.anchors).toEqual([]);
  expect(assessSocialScan(first, points, false).reference.anchors).toEqual([]);
  expect(
    assessSocialScan(first, [{ id: "bad", postedAt: "invalid" }], true).reference.anchors,
  ).toEqual([]);
});
it("ignores pinned posts as continuity anchors and rejects duplicate IDs", () => {
  expect(assessSocialScan(first, [{ ...points[0], pinned: true }], true).reference.anchors).toEqual(
    [],
  );
  expect(assessSocialScan(first, [points[0], points[0]], true).connected).toBe(false);
});
