import { describe, it, expect, vi, beforeEach } from "vitest";
import { postRunReportHandler } from "@/lib/agentRuns/postRunReportHandler";

const mock = vi.hoisted(() => ({ validate: vi.fn(), upsert: vi.fn() }));
vi.mock("@/lib/mcpAuth/validateMcpApiKey", () => ({ validateMcpApiKey: mock.validate }));
vi.mock("@/lib/agentRuns/upsertRun", () => ({ upsertRun: mock.upsert }));

function req(body: unknown) {
  return new Request("https://example.com/api/agent/run-report", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer test-key" },
    body: JSON.stringify(body),
  });
}

describe("postRunReportHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when API key is invalid", async () => {
    mock.validate.mockResolvedValue(null);
    const res = await postRunReportHandler(
      req({ workerId: "w1", runNumber: 1, status: "running", startedAt: "2026-01-01T00:00:00Z" }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when workerId is missing", async () => {
    mock.validate.mockResolvedValue("hash");
    const res = await postRunReportHandler(
      req({ runNumber: 1, status: "running", startedAt: "2026-01-01T00:00:00Z" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when runNumber is not a positive integer", async () => {
    mock.validate.mockResolvedValue("hash");
    const res = await postRunReportHandler(
      req({ workerId: "w1", runNumber: 0, status: "running", startedAt: "2026-01-01T00:00:00Z" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when status is invalid", async () => {
    mock.validate.mockResolvedValue("hash");
    const res = await postRunReportHandler(
      req({
        workerId: "w1",
        runNumber: 1,
        status: "bad",
        startedAt: "2026-01-01T00:00:00Z",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("upserts and returns success on valid input", async () => {
    mock.validate.mockResolvedValue("hash");
    mock.upsert.mockResolvedValue(undefined);
    const res = await postRunReportHandler(
      req({
        workerId: "w1",
        runNumber: 1,
        status: "running",
        startedAt: "2026-01-01T00:00:00Z",
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        workerId: "w1",
        apiKeyHash: "hash",
        runNumber: 1,
        status: "running",
      }),
    );
  });
});
