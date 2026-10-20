import { describe, it, expect, vi } from "vitest";

const { audit } = vi.hoisted(() => ({ audit: vi.fn() }));
vi.mock("@/lib/agentWork/getAuditLog", () => ({ getAuditLog: audit }));
vi.mock("@/lib/agentWork/getAgentBreakdown", () => ({
  getAgentBreakdown: async () => ({ agents: [] }),
}));
vi.mock("@/lib/agentWork/getExclusionsByPlatform", () => ({
  getExclusionsByPlatform: async () => ({ platforms: {} }),
}));
vi.mock("@/lib/agentWork/getRunHistory", () => ({
  getRunHistory: async () => ({ runs: [], total: 0 }),
}));
const { getAgentWorkDetails } = await import("@/lib/agentWork/getAgentWorkDetails");

describe("getAgentWorkDetails", () => {
  it("combines the four detail sections", async () => {
    const auditLog = { entries: [], total: 0, page: 3, limit: 10 };
    audit.mockResolvedValueOnce(auditLog);
    expect(await getAgentWorkDetails(3, 10)).toEqual({
      auditLog,
      agentBreakdown: { agents: [] },
      exclusions: { platforms: {} },
      runHistory: { runs: [], total: 0 },
    });
    expect(audit).toHaveBeenCalledWith(3, 10);
  });
});
