import { describe, it, expect, vi, afterEach } from "vitest";
import { waitAtMost } from "@/lib/async/waitAtMost";

afterEach(() => {
  vi.useRealTimers();
});

describe("waitAtMost", () => {
  it("resolves with the work when it finishes first", async () => {
    await expect(waitAtMost(Promise.resolve(7), 1000)).resolves.toBe(7);
  });

  it("resolves undefined when the budget passes first, without rejecting", async () => {
    vi.useFakeTimers();
    const pending = waitAtMost(new Promise(() => {}), 1000);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(pending).resolves.toBeUndefined();
  });

  it("passes a rejection through and leaves no timer behind", async () => {
    vi.useFakeTimers();
    await expect(waitAtMost(Promise.reject(new Error("boom")), 1000)).rejects.toThrow("boom");
    expect(vi.getTimerCount()).toBe(0);
  });
});
