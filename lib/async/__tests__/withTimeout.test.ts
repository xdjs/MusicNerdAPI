import { describe, it, expect, vi, afterEach } from "vitest";
import { withTimeout } from "@/lib/async/withTimeout";

afterEach(() => vi.useRealTimers());

describe("withTimeout", () => {
  it("resolves with the work when it finishes first", async () => {
    await expect(withTimeout(Promise.resolve(7), 1000, "late")).resolves.toBe(7);
  });

  it("rejects with the given message when the deadline passes first", async () => {
    vi.useFakeTimers();
    const pending = withTimeout(new Promise(() => {}), 1000, "caption extraction timed out");
    vi.advanceTimersByTime(1000);
    await expect(pending).rejects.toThrow("caption extraction timed out");
  });
});
