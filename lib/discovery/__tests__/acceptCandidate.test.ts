import { describe, it, expect, vi, beforeEach } from "vitest";
import { discoveryRun } from "@/lib/discovery/__tests__/discoveryRun";

const { validateCandidate } = vi.hoisted(() => ({ validateCandidate: vi.fn() }));
vi.mock("@/lib/discovery/validateCandidate", () => ({ validateCandidate }));
const { acceptCandidate } = await import("@/lib/discovery/acceptCandidate");

beforeEach(() => {
  validateCandidate.mockReset();
});

describe("acceptCandidate", () => {
  it("counts and returns a found event for a valid candidate, null otherwise", async () => {
    const run = discoveryRun(["x"]);
    const c = { tier: 4 as const, platform: "x" as const, url: "u", reasoning: null };
    validateCandidate.mockResolvedValueOnce({ siteName: "x" });
    expect(await acceptCandidate(run, c)).toEqual({ kind: "found", profile: { siteName: "x" } });
    expect(validateCandidate).toHaveBeenCalledWith(c, run.ctx);
    validateCandidate.mockResolvedValueOnce(null);
    expect(await acceptCandidate(run, c)).toBeNull();
    expect(run.foundCount).toBe(1);
  });
});
