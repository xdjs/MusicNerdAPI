import { describe, it, expect, vi, beforeEach } from "vitest";
import { mcpRequestContext } from "@/lib/mcpAuth/mcpRequestContext";

const { validate, handle } = vi.hoisted(() => ({
  validate: vi.fn(async (_r: Request): Promise<string | null> => "hash123"),
  handle: vi.fn(async (_r: Request) => new Response("ok", { status: 200 })),
}));
vi.mock("@/lib/mcpAuth/validateMcpApiKey", () => ({ validateMcpApiKey: validate }));
vi.mock("@/lib/mcp/handleMcpRequest", () => ({ handleMcpRequest: handle }));
const { postMcpHandler } = await import("@/lib/mcp/postMcpHandler");

const request = (auth?: string) =>
  new Request("https://api/mcp", {
    method: "POST",
    headers: auth ? { Authorization: auth } : {},
    body: "{}",
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("postMcpHandler", () => {
  it("passes a request without a key straight through, outside any context", async () => {
    let store: unknown = "unset";
    handle.mockImplementationOnce(async () => {
      store = mcpRequestContext.getStore();
      return new Response("ok");
    });
    expect((await postMcpHandler(request())).status).toBe(200);
    expect(validate).not.toHaveBeenCalled();
    expect(handle).toHaveBeenCalledTimes(1);
    expect(store).toBeUndefined();
  });

  it("runs a request with a valid key inside the request context", async () => {
    let store: unknown;
    handle.mockImplementationOnce(async () => {
      store = mcpRequestContext.getStore();
      return new Response("ok");
    });
    await postMcpHandler(request("Bearer good"));
    expect(validate).toHaveBeenCalledTimes(1);
    expect(store).toEqual({ apiKeyHash: "hash123" });
  });

  it("refuses an unknown or revoked key with a 401 JSON-RPC error before the transport", async () => {
    validate.mockResolvedValueOnce(null);
    const response = await postMcpHandler(request("Bearer bad"));
    expect(response.status).toBe(401);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await response.json()).toEqual({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Invalid or revoked API key" },
      id: null,
    });
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
});
