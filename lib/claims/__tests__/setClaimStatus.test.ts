import { describe, it, expect, vi, beforeEach } from "vitest";
import { setClaimStatus } from "@/lib/claims/setClaimStatus";

const m = vi.hoisted(() => ({ update: vi.fn(), set: vi.fn(), where: vi.fn(), returning: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { update: m.update } }));
beforeEach(() => {
  vi.clearAllMocks();
  m.update.mockReturnValue({ set: m.set });
  m.set.mockReturnValue({ where: m.where });
  m.where.mockReturnValue({ returning: m.returning });
});

describe("setClaimStatus", () => {
  it("sets the status, stamps updatedAt and returns the claim", async () => {
    const claim = { id: "c1", status: "approved" };
    m.returning.mockResolvedValueOnce([claim]);
    expect(await setClaimStatus("c1", "approved")).toBe(claim);
    expect(m.set.mock.calls[0][0]).toMatchObject({ status: "approved" });
    expect(m.set.mock.calls[0][0].updatedAt).toBeDefined();
  });

  it("is undefined when no claim has that id", async () => {
    m.returning.mockResolvedValueOnce([]);
    expect(await setClaimStatus("c1", "rejected")).toBeUndefined();
  });
});
