import { describe, it, expect, vi, beforeEach } from "vitest";

const context = {
  userId: "user-1",
  isAdmin: false,
  member: null,
  grantId: "grant-1",
  agent: "Claude",
};
const { authenticate, handle } = vi.hoisted(() => ({
  authenticate: vi.fn(async (_r: Request): Promise<unknown> => null),
  handle: vi.fn(async (_r: Request, _c: unknown) => new Response("ok", { status: 200 })),
}));
vi.mock("@/lib/mcp/authenticateMcpRequest", () => ({ authenticateMcpRequest: authenticate }));
vi.mock("@/lib/mcp/handleMcpRequest", () => ({ handleMcpRequest: handle }));
const { postMcpHandler } = await import("@/lib/mcp/postMcpHandler");

const request = () => new Request("https://api/mcp", { method: "POST", body: "{}" });

beforeEach(() => {
  vi.clearAllMocks();
  authenticate.mockResolvedValue(context);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("postMcpHandler", () => {
  it("runs an authenticated request through the transport with its context", async () => {
    expect((await postMcpHandler(request())).status).toBe(200);
    expect(handle).toHaveBeenCalledWith(expect.any(Request), context);
  });

  it("returns the 401 challenge without reaching the transport", async () => {
    authenticate.mockResolvedValue(new Response("unauthorized", { status: 401 }));
    expect((await postMcpHandler(request())).status).toBe(401);
    expect(handle).not.toHaveBeenCalled();
  });

  it("is a 500 JSON-RPC error when the transport throws", async () => {
    handle.mockRejectedValueOnce(new Error("boom"));
    const response = await postMcpHandler(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      jsonrpc: "2.0",
      error: { code: -32603, message: "Internal server error" },
      id: null,
    });
  });

  it("is a 500 JSON-RPC error with CORS headers when the token lookup throws", async () => {
    authenticate.mockRejectedValueOnce(new Error("connection refused"));
    const response = await postMcpHandler(request());
    expect(response.status).toBe(500);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(handle).not.toHaveBeenCalled();
  });
});
