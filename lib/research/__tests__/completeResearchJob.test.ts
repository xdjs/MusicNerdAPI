import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";

const execute = vi.fn();
vi.mock("@/lib/db/db", () => ({ db: { execute: (...a: unknown[]) => execute(...a) } }));
const { completeResearchJob } = await import("@/lib/research/completeResearchJob");

beforeEach(() => execute.mockReset().mockResolvedValue([]));
const failing = () =>
  execute.mockImplementationOnce(async () => {
    throw new Error("pool");
  });

describe("completeResearchJob", () => {
  it("marks the job done and clears the error", async () => {
    await completeResearchJob("job-1");
    expect(renderSql(execute.mock.calls[0][0]).text).toContain(
      "status = 'done', claimed_at = null, last_error = null",
    );
  });

  it("never throws on a database error", async () => {
    failing();
    await expect(completeResearchJob("j")).resolves.toBeUndefined();
  });
});
