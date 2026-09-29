import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-29T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("sinceLastCall", () => {
  it("lets the first call through at once and spaces the next by 1.1 s", async () => {
    const { sinceLastCall } = await import("@/lib/musicbrainz/sinceLastCall");
    expect(await sinceLastCall()).toBe(true);
    const start = Date.now();
    const second = sinceLastCall();
    await vi.advanceTimersByTimeAsync(1_100);
    expect(await second).toBe(true);
    expect(Date.now() - start).toBeGreaterThanOrEqual(1_100);
  });

  it("serializes concurrent callers instead of letting them burst", async () => {
    const { sinceLastCall } = await import("@/lib/musicbrainz/sinceLastCall");
    const times: number[] = [];
    const all = Promise.all(
      [0, 1, 2].map(() => sinceLastCall().then(() => times.push(Date.now()))),
    );
    await vi.advanceTimersByTimeAsync(3_000);
    await all;
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(1_100);
    expect(times[2] - times[1]).toBeGreaterThanOrEqual(1_100);
  });

  it("gives up without reserving when the deadline comes first, and doesn't delay later callers", async () => {
    const { sinceLastCall } = await import("@/lib/musicbrainz/sinceLastCall");
    await sinceLastCall();
    const late = sinceLastCall(Date.now() + 100);
    await vi.advanceTimersByTimeAsync(100);
    expect(await late).toBe(false);
    const next = sinceLastCall();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(await next).toBe(true);
  });

  it("is false immediately for a deadline already passed", async () => {
    const { sinceLastCall } = await import("@/lib/musicbrainz/sinceLastCall");
    expect(await sinceLastCall(Date.now() - 1)).toBe(false);
  });
});
