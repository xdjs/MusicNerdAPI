import { afterEach, expect, it, vi } from "vitest";
import { withAbortDeadline } from "../withAbortDeadline";
afterEach(() => vi.useRealTimers());
it("aborts the work at the deadline, even if the provider ignores cancellation", async () => {
  vi.useFakeTimers();
  let signal!: AbortSignal;
  const work = withAbortDeadline(s => {
    signal = s;
    return new Promise(() => {});
  }, 15000);
  const check = expect(work).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(15000);
  await check;
  expect(signal.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});
it("cleans up an early success and propagates an outer cancellation", async () => {
  vi.useFakeTimers();
  expect(await withAbortDeadline(async () => "ok", 15000)).toBe("ok");
  expect(vi.getTimerCount()).toBe(0);
  const outer = new AbortController();
  let signal!: AbortSignal;
  const work = withAbortDeadline(
    s => {
      signal = s;
      return new Promise(() => {});
    },
    30000,
    outer.signal,
  );
  const check = expect(work).rejects.toThrow();
  outer.abort();
  await check;
  expect(signal.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});
it("never starts work for an already cancelled request", async () => {
  const outer = new AbortController();
  outer.abort();
  const work = vi.fn();
  await expect(withAbortDeadline(work, 1000, outer.signal)).rejects.toThrow();
  expect(work).not.toHaveBeenCalled();
});
