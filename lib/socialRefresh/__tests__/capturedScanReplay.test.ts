import { it, expect } from "vitest";
import fixtures from "./fixtures/latasha-2026-10-12.json";
import { assessSocialScan } from "../assessSocialScan";
import { planSocialRefresh } from "../planSocialRefresh";
for (const capture of fixtures) {
  it(`reconnects captured ${capture.platform} results using the actual planned cutoff`, () => {
    const first = assessSocialScan(
      { startedAt: capture.baselineStartedAt, providerLimited: true },
      capture.baseline,
      true,
    );
    const plan = planSocialRefresh(
      { coveredThrough: null, checkedAt: capture.baselineStartedAt, reference: first.reference },
      new Date(Date.parse(capture.startedAt) + 20 * 60_000),
    );
    expect(plan.after).toBe(capture.cutoff);
    const result = assessSocialScan(
      { ...plan, startedAt: capture.startedAt, providerLimited: true },
      capture.posts,
      true,
    );
    expect(result.connected).toBe(true);
    expect(
      result.reference.anchors.every(a => !capture.posts.find(p => p.id === a.id)?.pinned),
    ).toBe(true);
    const got = new Set(capture.posts.map(p => p.id));
    expect(capture.baseline.filter(p => p.postedAt >= capture.cutoff && !got.has(p.id))).toEqual(
      [],
    );
  });
  it(`does not advance ${capture.platform} on a truncated version of the captured dataset`, () => {
    const previous = assessSocialScan(
      { startedAt: capture.baselineStartedAt },
      capture.baseline,
      true,
    ).reference;
    const partial = capture.posts.filter(p => p.id !== previous.anchors[0].id);
    const result = assessSocialScan(
      { startedAt: capture.startedAt, reference: previous, providerLimited: true },
      partial,
      true,
    );
    expect(result.connected).toBe(false);
    expect(result.reference.anchors).toEqual(previous.anchors);
    expect(result.reference.gapSince).toBe(previous.observedAt);
  });
}
