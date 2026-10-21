import { describe, it, expect, vi, beforeEach } from "vitest";

const { validate, upsert } = vi.hoisted(() => ({
  validate: vi.fn(async (_r: Request): Promise<string | null> => "hash123"),
  upsert: vi.fn(async (_p: unknown) => {}),
}));
vi.mock("@/lib/mcpAuth/validateMcpApiKey", () => ({ validateMcpApiKey: validate }));
vi.mock("@/lib/agentReports/upsertHeartbeat", () => ({ upsertHeartbeat: upsert }));
const { postHeartbeatHandler } = await import("@/lib/agentReports/postHeartbeatHandler");

const request = (body: unknown, apiKey = "test-key") =>
  new Request("https://api/agent/heartbeat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "debug").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("postHeartbeatHandler", () => {
  it("is 401 when the key is invalid, before reading the body", async () => {
    validate.mockResolvedValueOnce(null);
    const res = await postHeartbeatHandler(request({ workerId: "w1", status: "running" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid or missing API key" });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("is 400 with the validator's message", async () => {
    const res = await postHeartbeatHandler(request({ status: "running" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "workerId is required" });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("upserts with the key's hash and answers { success: true } with CORS headers", async () => {
    const res = await postHeartbeatHandler(
      request({
        workerId: "w1",
        status: "running",
        currentRun: 5,
        batchPlatform: "deezer",
        batchSize: 50,
        message: "Run 5 starting",
        config: { batchTimeout: 1200 },
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(upsert).toHaveBeenCalledWith({
      workerId: "w1",
      apiKeyHash: "hash123",
      status: "running",
      currentRun: 5,
      batchPlatform: "deezer",
      batchSize: 50,
      message: "Run 5 starting",
      config: { batchTimeout: 1200 },
    });
  });

  it("is 500 { error } when the body is not JSON or the write fails", async () => {
    const bad = await postHeartbeatHandler(request("not json"));
    expect(bad.status).toBe(500);
    expect(await bad.json()).toEqual({ error: "Internal server error" });
    upsert.mockRejectedValueOnce(new Error("db down"));
    const failed = await postHeartbeatHandler(request({ workerId: "w1", status: "idle" }));
    expect(failed.status).toBe(500);
  });
});
