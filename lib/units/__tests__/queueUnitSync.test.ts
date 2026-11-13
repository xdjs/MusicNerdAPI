import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const { queueUnitSync } = await import("@/lib/units/queueUnitSync");

beforeEach(() => execute.mockReset().mockResolvedValue([{ id: "j1" }]));

describe("queueUnitSync", () => {
  it("inserts a pending unit_sync job that yields to a live one", async () => {
    expect(await queueUnitSync("a1")).toBe(true);
    const { text, params } = renderSql(execute.mock.calls[0][0]);
    expect(text).toContain("insert into artist_research_jobs");
    expect(text).toContain("'unit_sync'");
    expect(text).toContain("'pending'");
    expect(text).toContain(
      "on conflict (artist_id, kind) where status in ('pending', 'running') do nothing",
    );
    expect(params).toContain("a1");
  });

  it("returns false when a live job already exists", async () => {
    execute.mockResolvedValue([]);
    expect(await queueUnitSync("a1")).toBe(false);
  });

  it("uses the given transaction instead of the pool", async () => {
    const txExecute = vi.fn().mockResolvedValue({ rows: [{ id: "j2" }] });
    expect(await queueUnitSync("a1", { execute: txExecute } as never)).toBe(true);
    expect(txExecute).toHaveBeenCalledOnce();
    expect(execute).not.toHaveBeenCalled();
  });
});
