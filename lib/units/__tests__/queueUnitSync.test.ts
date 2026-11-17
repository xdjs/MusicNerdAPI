import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const { queueUnitSync } = await import("@/lib/units/queueUnitSync");

beforeEach(() => execute.mockReset().mockResolvedValue([{ inserted: true }]));

describe("queueUnitSync", () => {
  it("inserts a pending unit_sync job, or asks a live one to rescan", async () => {
    expect(await queueUnitSync("a1")).toBe(true);
    const { text, params } = renderSql(execute.mock.calls[0][0]);
    expect(text).toContain("insert into artist_research_jobs");
    expect(text).toContain("'unit_sync'");
    expect(text).toContain("'pending'");
    expect(text).toContain(
      `on conflict (artist_id, kind) where status in ('pending', 'running') do update set state = coalesce(artist_research_jobs.state, '{}'::jsonb) || '{"rescan":true}'::jsonb`,
    );
    expect(text).toContain("returning (xmax = 0) as inserted");
    expect(params).toContain("a1");
  });

  it("returns false when a live job already exists and was asked to rescan", async () => {
    execute.mockResolvedValue([{ inserted: false }]);
    expect(await queueUnitSync("a1")).toBe(false);
  });

  it("uses the given transaction instead of the pool", async () => {
    const txExecute = vi.fn().mockResolvedValue({ rows: [{ inserted: true }] });
    expect(await queueUnitSync("a1", { execute: txExecute } as never)).toBe(true);
    expect(txExecute).toHaveBeenCalledOnce();
    expect(execute).not.toHaveBeenCalled();
  });
});
