import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";

const execute = vi.fn();
vi.mock("@/lib/db/db", () => ({ db: { execute: (...a: unknown[]) => execute(...a) } }));
const { saveJobState } = await import("@/lib/research/saveJobState");

beforeEach(() => execute.mockReset().mockResolvedValue([]));
const failing = () =>
  execute.mockImplementationOnce(async () => {
    throw new Error("pool");
  });

describe("saveJobState", () => {
  it("writes the state and keeps the claim", async () => {
    await saveJobState("job-1", { a: 1 });
    const { text, params } = renderSql(execute.mock.calls[0][0]);
    expect(text).toContain("claimed_at = now()");
    expect(text).not.toContain("status");
    expect(params).toEqual([JSON.stringify({ a: 1 }), "job-1"]);
  });

  it("never throws on a database error", async () => {
    failing();
    await expect(saveJobState("j", {})).resolves.toBeUndefined();
  });
});
