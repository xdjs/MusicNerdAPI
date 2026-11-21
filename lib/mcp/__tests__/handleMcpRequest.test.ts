import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/db", () => ({ db: {} }));
const { handleMcpRequest } = await import("@/lib/mcp/handleMcpRequest");

const context = { userId: "user-1", isAdmin: false, member: null, grantId: "grant-1" };
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://api/mcp", {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("handleMcpRequest", () => {
  it("answers initialize on an SSE stream with the server info and CORS headers", async () => {
    const response = await handleMcpRequest(
      post({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "t", version: "1" },
        },
      }),
      context,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/^text\/event-stream/);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await response.text()).toContain('"serverInfo":{"name":"Music Nerd","version":"1.0.0"}');
  });

  it("lists the tools the connection's user may use", async () => {
    const response = await handleMcpRequest(
      post(
        { jsonrpc: "2.0", id: 2, method: "tools/list" },
        { "Mcp-Protocol-Version": "2025-06-18" },
      ),
      context,
    );
    const text = await response.text();
    const data = JSON.parse(
      text
        .split("\n")
        .find(l => l.startsWith("data: "))!
        .slice(6),
    );
    const names = data.result.tools.map((t: { name: string }) => t.name);
    expect(names).toContain("search_artists");
    expect(names).not.toContain("set_artist_link");
  });

  it("is 406 as a JSON-RPC error when the client does not accept both media types", async () => {
    const response = await handleMcpRequest(
      new Request("https://api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
      context,
    );
    expect(response.status).toBe(406);
    expect(await response.json()).toMatchObject({
      jsonrpc: "2.0",
      error: { code: -32000 },
      id: null,
    });
  });
});
