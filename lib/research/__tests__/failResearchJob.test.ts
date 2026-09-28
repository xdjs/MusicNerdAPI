import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";

const execute = vi.fn();
vi.mock("@/lib/db/db", () => ({ db: { execute: (...a: unknown[]) => execute(...a) } }));
const { failResearchJob } = await import("@/lib/research/failResearchJob");

beforeEach(() => execute.mockReset().mockResolvedValue([]));
const failing = () =>
  execute.mockImplementationOnce(async () => {
    throw new Error("pool");
  });

describe("failResearchJob", () => {
  it("counts the failure, gives up at the limit and truncates the error", async () => {
    await failResearchJob("job-1", "x".repeat(600));
    const { text, params } = renderSql(execute.mock.calls[0][0]);
    expect(text).toContain("attempts = attempts + 1");
    expect(text).toMatch(/case when attempts \+ 1 >= \$\d+ then 'failed' else 'pending' end/);
    expect(params).toContain(4);
    expect(params).toContain("x".repeat(500));
  });

  it("never throws on a database error", async () => {
    failing();
    await expect(failResearchJob("j", "e")).resolves.toBeUndefined();
  });
});
