import { describe, expect, it, vi } from "vitest";
import { MAX_ALLOWANCE_WAIT_MS, withAllowanceWait } from "@/lib/evals/withAllowanceWait";

const quota = (retryAfterSeconds: number) => ({
  answer: "",
  error: "429 You've reached your question limit for this hour.",
  retryAfterSeconds,
});
const answered = { answer: "Richmond [1]." };

describe("withAllowanceWait", () => {
  it("returns an answered turn without waiting", async () => {
    const sleep = vi.fn();
    const attempt = vi.fn().mockResolvedValue(answered);
    expect(await withAllowanceWait(attempt, { sleep })).toBe(answered);
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("waits for the reported reset plus a margin, then asks once more", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const log = vi.fn();
    const attempt = vi.fn().mockResolvedValueOnce(quota(600)).mockResolvedValueOnce(answered);
    expect(await withAllowanceWait(attempt, { sleep, log })).toBe(answered);
    expect(sleep).toHaveBeenCalledWith(602_000);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("waiting 602 s"));
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it("returns the second attempt as it is, even when the allowance is still closed", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const attempt = vi.fn().mockResolvedValueOnce(quota(1)).mockResolvedValueOnce(quota(1));
    expect(await withAllowanceWait(attempt, { sleep, log: vi.fn() })).toEqual(quota(1));
    expect(attempt).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("does not wait past the hourly window, so a daily allowance is an error", async () => {
    const sleep = vi.fn();
    const attempt = vi.fn().mockResolvedValue(quota(20 * 3600));
    expect(await withAllowanceWait(attempt, { sleep })).toEqual(quota(20 * 3600));
    expect(sleep).not.toHaveBeenCalled();
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(MAX_ALLOWANCE_WAIT_MS).toBe(61 * 60 * 1000);
  });

  it("does not wait on an error that is not an allowance", async () => {
    const sleep = vi.fn();
    const failed = { answer: "", error: "500 error" };
    const attempt = vi.fn().mockResolvedValue(failed);
    expect(await withAllowanceWait(attempt, { sleep })).toBe(failed);
    expect(sleep).not.toHaveBeenCalled();
  });
});
