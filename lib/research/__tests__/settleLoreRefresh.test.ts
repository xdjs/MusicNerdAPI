import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";

const execute = vi.fn();
vi.mock("@/lib/db/db", () => ({ db: { execute: (...a: unknown[]) => execute(...a) } }));
const { settleLoreRefresh } = await import("@/lib/research/settleLoreRefresh");

beforeEach(() => execute.mockReset());

describe("settleLoreRefresh", () => {
  it("finishes the job only if no newer request arrived during the rebuild", async () => {
    execute.mockResolvedValueOnce([{ status: "done" }]);
    expect(await settleLoreRefresh("job-1", "2026-09-29T00:00:00Z")).toBe(true);
    const { text, params } = renderSql(execute.mock.calls[0][0]);
    expect(text).toContain(
      "status = case when coalesce(state->>'requestedAt', '') = $1 then 'done' else 'pending' end",
    );
    expect(text).toContain("claimed_at = null");
    expect(text).toContain("last_error = null");
    expect(text).toContain("returning status");
    expect(params).toEqual(["2026-09-29T00:00:00Z", "job-1"]);
  });

  it("is not done when a newer request re-queued it", async () => {
    execute.mockResolvedValueOnce([{ status: "pending" }]);
    expect(await settleLoreRefresh("job-1", "")).toBe(false);
  });

  it("is done when the job row is gone", async () => {
    execute.mockResolvedValueOnce([]);
    expect(await settleLoreRefresh("job-1", "")).toBe(true);
  });
});
