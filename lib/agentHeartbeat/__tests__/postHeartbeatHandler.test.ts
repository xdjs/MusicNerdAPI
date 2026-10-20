import { describe, it, expect, vi, beforeEach } from "vitest";
import { postHeartbeatHandler } from "@/lib/agentHeartbeat/postHeartbeatHandler";

const mock = vi.hoisted(() => ({ validate: vi.fn(), upsert: vi.fn() }));
vi.mock("@/lib/mcpAuth/validateMcpApiKey", () => ({ validateMcpApiKey: mock.validate }));
vi.mock("@/lib/agentHeartbeat/upsertHeartbeat", () => ({ upsertHeartbeat: mock.upsert }));

function req(body: unknown) {
  return new Request("https://example.com/api/agent/heartbeat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer test-key" },
    body: JSON.stringify(body),
  });
}

describe("postHeartbeatHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when API key is invalid", async () => {
    mock.validate.mockResolvedValue(null);
    const res = await postHeartbeatHandler(req({ workerId: "w1", status: "running" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when workerId is missing", async () => {
    mock.validate.mockResolvedValue("hash");
    const res = await postHeartbeatHandler(req({ status: "running" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when status is invalid", async () => {
    mock.validate.mockResolvedValue("hash");
    const res = await postHeartbeatHandler(req({ workerId: "w1", status: "invalid" }));
    expect(res.status).toBe(400);
  });

  it("upserts and returns success on valid input", async () => {
    mock.validate.mockResolvedValue("hash");
    mock.upsert.mockResolvedValue(undefined);
    const res = await postHeartbeatHandler(req({ workerId: "w1", status: "running" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ workerId: "w1", apiKeyHash: "hash", status: "running" }),
    );
  });
});
