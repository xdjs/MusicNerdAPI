import { afterEach, describe, expect, it, vi } from "vitest";
import { PROVIDER_TIMEOUT_MS } from "@/lib/trackLinks/const";
import { withProviderTimeout } from "@/lib/trackLinks/withProviderTimeout";

afterEach(() => vi.useRealTimers());

describe("withProviderTimeout", () => {
  it("returns the result when the provider answers in time", async () => {
    expect(await withProviderTimeout(Promise.resolve("ok"))).toBe("ok");
  });

  it("resolves null on a failure", async () => {
    expect(await withProviderTimeout(Promise.reject(new Error("down")))).toBeNull();
  });

  it("resolves null once the provider's time is up", async () => {
    vi.useFakeTimers();
    const pending = withProviderTimeout(new Promise(() => {}));
    await vi.advanceTimersByTimeAsync(PROVIDER_TIMEOUT_MS);
    expect(await pending).toBeNull();
  });
});
