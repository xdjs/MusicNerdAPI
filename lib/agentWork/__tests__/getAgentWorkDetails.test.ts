import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAgentWorkDetails } from "@/lib/agentWork/getAgentWorkDetails";

const mock = vi.hoisted(() => ({
  audit: vi.fn(),
  breakdown: vi.fn(),
  exclusions: vi.fn(),
  runs: vi.fn(),
  order: [] as string[],
}));
vi.mock("@/lib/agentWork/getAuditLog", () => ({ getAuditLog: mock.audit }));
vi.mock("@/lib/agentWork/getAgentBreakdown", () => ({ getAgentBreakdown: mock.breakdown }));
vi.mock("@/lib/agentWork/getExclusionsByPlatform", () => ({
  getExclusionsByPlatform: mock.exclusions,
}));
vi.mock("@/lib/agentWork/getRunHistory", () => ({ getRunHistory: mock.runs }));

const auditLog = { entries: [], total: 0, page: 2, limit: 25 };
const agentBreakdown = { agents: [] };
const exclusions = { platforms: {} };
const runHistory = { runs: [], total: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  mock.order.length = 0;
  const step = (name: string, value: unknown) => async () => {
    mock.order.push(name);
    return value;
  };
  mock.audit.mockImplementation(step("audit", auditLog));
  mock.breakdown.mockImplementation(step("breakdown", agentBreakdown));
  mock.exclusions.mockImplementation(step("exclusions", exclusions));
  mock.runs.mockImplementation(step("runs", runHistory));
});

describe("getAgentWorkDetails", () => {
  it("loads the four sections one after another, passing the audit page through", async () => {
    expect(await getAgentWorkDetails(2, 25)).toEqual({
      auditLog,
      agentBreakdown,
      exclusions,
      runHistory,
    });
    expect(mock.audit).toHaveBeenCalledWith(2, 25);
    expect(mock.runs).toHaveBeenCalledWith();
    expect(mock.order).toEqual(["audit", "breakdown", "exclusions", "runs"]);
  });

  it("defaults to the first page of 50", async () => {
    await getAgentWorkDetails();
    expect(mock.audit).toHaveBeenCalledWith(1, 50);
  });
});
