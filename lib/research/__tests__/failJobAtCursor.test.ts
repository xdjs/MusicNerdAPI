import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";

const execute = vi.fn();
vi.mock("@/lib/db/db", () => ({ db: { execute: (...a: unknown[]) => execute(...a) } }));
const { failJobAtCursor } = await import("@/lib/research/failJobAtCursor");

beforeEach(() => execute.mockReset().mockResolvedValue([]));

describe("failJobAtCursor", () => {
  it("saves the cursor, total and state and counts the failure in one statement", async () => {
    await failJobAtCursor("job-1", 5, 25, { mode: "full" }, "x".repeat(600));
    expect(execute).toHaveBeenCalledTimes(1);
    const { text, params } = renderSql(execute.mock.calls[0][0]);
    expect(text).toContain("attempts = attempts + 1");
    expect(text).toMatch(/case when attempts \+ 1 >= \$\d+ then 'failed' else 'pending' end/);
    expect(text).toContain("claimed_at = null");
    expect(params).toEqual(
      expect.arrayContaining([
        5,
        25,
        JSON.stringify({ mode: "full" }),
        4,
        "x".repeat(500),
        "job-1",
      ]),
    );
  });

  it("never throws on a database error", async () => {
    execute.mockImplementationOnce(async () => {
      throw new Error("pool");
    });
    await expect(failJobAtCursor("j", 0, null, {}, "e")).resolves.toBeUndefined();
  });
});
