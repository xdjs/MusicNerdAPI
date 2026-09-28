import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";

const execute = vi.fn();
vi.mock("@/lib/db/db", () => ({ db: { execute: (...a: unknown[]) => execute(...a) } }));
const { saveJobProgress } = await import("@/lib/research/saveJobProgress");

beforeEach(() => execute.mockReset().mockResolvedValue([]));
const failing = () =>
  execute.mockImplementationOnce(async () => {
    throw new Error("pool");
  });

describe("saveJobProgress", () => {
  it("hands the lease back and clears the failure count", async () => {
    await saveJobProgress("job-1", 9, { total: 30, state: { a: 1 } });
    const { text, params } = renderSql(execute.mock.calls[0][0]);
    expect(text).toContain("status = 'pending', claimed_at = null, attempts = 0");
    expect(params).toEqual(expect.arrayContaining([9, 30, JSON.stringify({ a: 1 }), "job-1"]));
  });

  it("never throws on a database error", async () => {
    failing();
    await expect(saveJobProgress("j", 0)).resolves.toBeUndefined();
  });
});
