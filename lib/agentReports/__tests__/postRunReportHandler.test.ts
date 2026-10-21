import { describe, it, expect, vi, beforeEach } from "vitest";

const { validate, upsert } = vi.hoisted(() => ({
  validate: vi.fn(async (_r: Request): Promise<string | null> => "hash123"),
  upsert: vi.fn(async (_p: unknown) => {}),
}));
vi.mock("@/lib/mcpAuth/validateMcpApiKey", () => ({ validateMcpApiKey: validate }));
vi.mock("@/lib/agentReports/upsertRun", () => ({ upsertRun: upsert }));
const { postRunReportHandler } = await import("@/lib/agentReports/postRunReportHandler");

const valid = {
  workerId: "w1",
  runNumber: 1,
  status: "running",
  startedAt: "2026-03-25T12:00:00Z",
};
const request = (body: unknown) =>
  new Request("https://api/agent/run-report", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer test-key" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "debug").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("postRunReportHandler", () => {
  it("is 401 when the key is invalid", async () => {
    validate.mockResolvedValueOnce(null);
    const res = await postRunReportHandler(request(valid));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid or missing API key" });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("is 400 with the validator's message", async () => {
    const res = await postRunReportHandler(request({ ...valid, runNumber: 3.5 }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "runNumber must be a positive integer" });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("upserts the report with the key's hash and answers { success: true }", async () => {
    const res = await postRunReportHandler(
      request({ ...valid, status: "success", resolved: 10, wallTimeSecs: 300, turns: 25 }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(upsert).toHaveBeenCalledWith({
      ...valid,
      apiKeyHash: "hash123",
      status: "success",
      resolved: 10,
      wallTimeSecs: 300,
      turns: 25,
    });
  });

  it("is 500 { error } when the body is not JSON or the write fails", async () => {
    const bad = await postRunReportHandler(request("{"));
    expect(bad.status).toBe(500);
    expect(await bad.json()).toEqual({ error: "Internal server error" });
    upsert.mockRejectedValueOnce(new Error("db down"));
    expect((await postRunReportHandler(request(valid))).status).toBe(500);
  });
});
