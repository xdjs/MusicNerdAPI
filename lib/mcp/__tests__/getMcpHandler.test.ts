import { describe, it, expect, vi, beforeEach } from "vitest";

const { handle } = vi.hoisted(() => ({
  handle: vi.fn(async (_r: Request) => new Response("stream", { status: 200 })),
}));
vi.mock("@/lib/mcp/handleMcpRequest", () => ({ handleMcpRequest: handle }));
const { getMcpHandler } = await import("@/lib/mcp/getMcpHandler");

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getMcpHandler", () => {
  it("answers the health check with the server info and CORS headers", async () => {
    const response = await getMcpHandler(new Request("https://api/mcp"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await response.json()).toEqual({
      name: "Music Nerd",
      version: "1.0.0",
      status: "ok",
      protocol: "mcp",
      transport: "streamable-http",
    });
    expect(handle).not.toHaveBeenCalled();
  });

  it("hands an SSE request to the transport", async () => {
    const response = await getMcpHandler(
      new Request("https://api/mcp", { headers: { Accept: "text/event-stream" } }),
    );
    expect(await response.text()).toBe("stream");
    expect(handle).toHaveBeenCalledTimes(1);
  });

  it("is 500 { error } when the transport throws", async () => {
    handle.mockRejectedValueOnce(new Error("boom"));
    const response = await getMcpHandler(
      new Request("https://api/mcp", { headers: { Accept: "text/event-stream" } }),
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal server error" });
  });
});
