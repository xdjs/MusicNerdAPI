import { describe, it, expect, vi } from "vitest";
import { getClaimById } from "@/lib/claims/getClaimById";

const m = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { query: { artistClaims: { findFirst: m.findFirst } } } }));

describe("getClaimById", () => {
  it("reads the claim", async () => {
    m.findFirst.mockResolvedValueOnce({ id: "c1" });
    expect(await getClaimById("c1")).toEqual({ id: "c1" });
    expect(m.findFirst).toHaveBeenCalledOnce();
  });
});
