import { describe, it, expect, vi, afterEach } from "vitest";
import { wait } from "@/lib/musicbrainz/wait";

afterEach(() => vi.useRealTimers());

describe("wait", () => {
  it("resolves after the delay", async () => {
    vi.useFakeTimers();
    let done = false;
    const p = wait(1000).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(done).toBe(true);
  });
});
