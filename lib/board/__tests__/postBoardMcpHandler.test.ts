import { beforeEach, describe, expect, it, vi } from "vitest";
import { postBoardMcpHandler } from "@/lib/board/postBoardMcpHandler";

const mock = vi.hoisted(() => ({ find: vi.fn(), as: vi.fn() }));
vi.mock("@/lib/board/findBoardKey", () => ({ findBoardKey: mock.find }));
vi.mock("@/lib/board/team", () => ({ team: { as: mock.as } }));

const rpc = (body: unknown) =>
  new Request("https://api.musicnerd.test/api/board/mcp/raw", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("postBoardMcpHandler", () => {
  it("refuses an unknown or revoked key with 401 before any board work", async () => {
    mock.find.mockResolvedValueOnce(null);
    const res = await postBoardMcpHandler(
      rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      "raw",
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Invalid or revoked board key" },
      id: null,
    });
    expect(mock.as).not.toHaveBeenCalled();
  });

  it("serves the key's profile, narrowed to reading and posting", async () => {
    mock.find.mockResolvedValueOnce("claude-duet-sweetman");
    mock.as.mockReturnValueOnce({});
    const res = await postBoardMcpHandler(
      rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      "raw",
    );
    expect(res.status).toBe(200);
    expect(mock.as).toHaveBeenCalledWith("claude-duet-sweetman", { can: ["read", "post"] });
    const text = await res.text();
    for (const name of ["list_channels", "read_channel", "read_thread", "post", "reply"])
      expect(text).toContain(name);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("answers a failure with a JSON-RPC 500", async () => {
    mock.find.mockRejectedValueOnce(new Error("db down"));
    const res = await postBoardMcpHandler(rpc({}), "raw");
    expect(res.status).toBe(500);
    expect((await res.json()).error).toEqual({ code: -32603, message: "Internal server error" });
  });
});
