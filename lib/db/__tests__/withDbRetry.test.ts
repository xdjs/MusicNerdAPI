import { describe, it, expect, vi } from "vitest";
import { withDbRetry } from "@/lib/db/withDbRetry";

describe("withDbRetry", () => {
  it("returns the first successful result", async () => {
    expect(await withDbRetry(async () => 1)).toBe(1);
  });

  it("retries a transient error with backoff and then gives up", async () => {
    vi.useFakeTimers();
    const operation = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error("x"), { code: "CONNECT_TIMEOUT" }));
    const pending = withDbRetry(operation, 2, 10);
    const settled = pending.catch(error => error);
    await vi.advanceTimersByTimeAsync(10 + 20);
    expect(((await settled) as { code: string }).code).toBe("CONNECT_TIMEOUT");
    expect(operation).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it("does not retry other errors", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("syntax error"));
    await expect(withDbRetry(operation)).rejects.toThrow("syntax error");
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
