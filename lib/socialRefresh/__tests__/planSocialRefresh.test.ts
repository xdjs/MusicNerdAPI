import { describe, expect, it } from "vitest";
import { planSocialRefresh } from "../planSocialRefresh";
const now = new Date("2026-10-12T12:00:00Z");
const row = { coveredThrough: "2026-10-11T10:00:00Z", checkedAt: "2026-10-11T10:05:00Z" };
describe("account scan window", () => {
  it("keeps first collection bounded without inventing coverage", () => {
    expect(planSocialRefresh(null, now, 30)).toEqual({
      startedAt: now.toISOString(),
      after: "2026-09-12T12:00:00.000Z",
    });
  });
  it("uses completed coverage plus 48 hour edit overlap", () => {
    expect(planSocialRefresh(row, now, 30).after).toBe("2026-10-09T10:00:00.000Z");
  });
  it("reuses a recent successful check including an empty or limited scan", () => {
    expect(planSocialRefresh({ ...row, checkedAt: "2026-10-12T11:55:00Z" }, now)).toMatchObject({
      skip: true,
    });
  });
  it("limited scans without coverage retain the baseline after cooldown", () => {
    expect(
      planSocialRefresh({ coveredThrough: null, checkedAt: row.checkedAt }, now, 30).after,
    ).toBe("2026-09-12T12:00:00.000Z");
  });
  it.each(["bad", "2027-01-01T00:00:00Z"])("does not trust invalid/future boundaries %s", value => {
    expect(planSocialRefresh({ coveredThrough: value, checkedAt: value }, now, 30)).toEqual(
      planSocialRefresh(null, now, 30),
    );
  });
  it("does not widen the existing latest lookback", () => {
    expect(
      planSocialRefresh(
        { coveredThrough: "2020-01-01T00:00:00Z", checkedAt: "2020-01-01T00:00:00Z" },
        now,
        30,
      ).after,
    ).toBe("2026-09-12T12:00:00.000Z");
  });
});

it("keeps saved anchors within the next query even after a quiet month", () => {
  const reference = {
    anchors: [{ id: "old", postedAt: "2026-08-01T00:00:00Z" }],
    observedAt: "2026-08-02T00:00:00Z",
    gapSince: null,
  };
  const result = planSocialRefresh(
    { checkedAt: "2026-08-02T00:00:00Z", coveredThrough: null, reference },
    new Date("2026-10-12T00:00:00Z"),
    30,
  );
  expect(result.after).toBe("2026-07-30T00:00:00.000Z");
  expect(result.reference).toEqual(reference);
});
