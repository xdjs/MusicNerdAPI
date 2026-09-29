import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import type { SQL } from "drizzle-orm";

const findFirst = vi.fn();
vi.mock("@/lib/db/db", () => ({
  db: { query: { artistClaims: { findFirst: (...a: unknown[]) => findFirst(...a) } } },
}));
const { getLoreClaimGeneration } = await import("@/lib/lore/getLoreClaimGeneration");

beforeEach(() => findFirst.mockReset());

describe("getLoreClaimGeneration", () => {
  it("is the approved claim's id, or null with none", async () => {
    findFirst.mockResolvedValueOnce({ id: "claim-1" });
    expect(await getLoreClaimGeneration("a1")).toBe("claim-1");
    expect(renderSql(findFirst.mock.calls[0][0].where as SQL).params).toEqual(["a1", "approved"]);
    findFirst.mockResolvedValueOnce(undefined);
    expect(await getLoreClaimGeneration("a1")).toBeNull();
  });
});
