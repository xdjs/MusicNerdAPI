import { describe, it, expect, vi, beforeEach } from "vitest";

const { findApprovedClaim } = vi.hoisted(() => ({ findApprovedClaim: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { query: {} } }));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({ findApprovedClaim }));
const { getLoreClaimGeneration } = await import("@/lib/ownership/getLoreClaimGeneration");
const { db } = await import("@/lib/db/db");

beforeEach(() => findApprovedClaim.mockReset());

describe("getLoreClaimGeneration", () => {
  it("is the approved claim's id, read from the plain client", async () => {
    findApprovedClaim.mockResolvedValue({ id: "c1" });
    expect(await getLoreClaimGeneration("a1")).toBe("c1");
    expect(findApprovedClaim).toHaveBeenCalledWith(db, "a1");
  });

  it("is null for an unclaimed artist", async () => {
    findApprovedClaim.mockResolvedValue(undefined);
    expect(await getLoreClaimGeneration("a1")).toBeNull();
  });
});
