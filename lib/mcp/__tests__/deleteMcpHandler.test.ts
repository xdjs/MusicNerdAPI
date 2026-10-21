import { describe, it, expect, vi, beforeEach } from "vitest";

const { handle } = vi.hoisted(() => ({
  handle: vi.fn(async (_r: Request) => new Response(null, { status: 200 })),
}));
vi.mock("@/lib/mcp/handleMcpRequest", () => ({ handleMcpRequest: handle }));
const { deleteMcpHandler } = await import("@/lib/mcp/deleteMcpHandler");

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("deleteMcpHandler", () => {
  it("hands the request to the transport", async () => {
    const request = new Request("https://api/mcp", { method: "DELETE" });
    expect((await deleteMcpHandler(request)).status).toBe(200);
    expect(handle).toHaveBeenCalledWith(request);
  });

  it("is 500 { error } when the transport throws", async () => {
    handle.mockRejectedValueOnce(new Error("boom"));
    const response = await deleteMcpHandler(new Request("https://api/mcp", { method: "DELETE" }));
    expect(response.status).toBe(500);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await response.json()).toEqual({ error: "Internal server error" });
  });
});
