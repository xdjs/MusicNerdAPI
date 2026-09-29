import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import type { SQL } from "drizzle-orm";

const findMany = vi.fn();
vi.mock("@/lib/db/db", () => ({
  db: { query: { artistVaultSources: { findMany: (...a: unknown[]) => findMany(...a) } } },
}));
const { getApprovedVaultSources } = await import("@/lib/lore/getApprovedVaultSources");

beforeEach(() => findMany.mockReset());

describe("getApprovedVaultSources", () => {
  it("reads the artist's approved sources, newest first", async () => {
    findMany.mockResolvedValueOnce([{ id: "s1" }]);
    expect(await getApprovedVaultSources("a1")).toEqual([{ id: "s1" }]);
    const { where, orderBy } = findMany.mock.calls[0][0];
    const { text, params } = renderSql(where as SQL);
    expect(text).toContain('"status" = $2');
    expect(params).toEqual(["a1", "approved"]);
    expect(renderSql(orderBy[0] as SQL).text).toContain('"created_at" desc');
  });

  it("returns [] on a database error", async () => {
    findMany.mockImplementationOnce(async () => {
      throw new Error("pool");
    });
    expect(await getApprovedVaultSources("a1")).toEqual([]);
  });
});
